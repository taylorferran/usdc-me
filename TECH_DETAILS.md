# USDC-ME Technical Details

## Architecture Overview

USDC-ME is a Next.js 16 application on Arc Testnet (chain ID 5042002). All signing happens client-side. The server never sees raw private keys (except for withdrawals, where the key is passed to create a `GatewayClient`). Payments are x402 spend intents verified and queued server-side, then settled in batches.

**External dependencies:**
- `@circlefin/x402-batching/client` -- `GatewayClient` for balances, deposits, withdrawals
- `@circlefin/x402-batching/server` -- `BatchFacilitatorClient` for `.verify()` and `.settle()`
- Supabase -- Auth (email/password) and PostgreSQL database
- Arc Testnet RPC at `https://arc-testnet.drpc.org`

**Database tables:**
- `profiles` -- user handle, wallet address, encrypted_key_blob, recovery_key_blob
- `transactions` -- all intents (types: send, merchant_payment, withdraw)
- `merchants` -- merchant accounts with API keys
- `payment_requests` -- merchant-created payment links
- `push_subscriptions` -- web push notification endpoints

---

## P2P Flow Diagram

```
 SENDER (Browser)                    SERVER                      ARC CHAIN
 ──────────────────                  ──────                      ─────────

 1. Enter @handle + amount
        │
        ▼
 2. Resolve handle ──────────► Supabase: profiles table
                               lookup wallet_address
                   ◄──────────── return 0x address
        │
        ▼
 3. Sign EIP-712 intent
    (signX402Payment)
    ┌─────────────────┐
    │ domain:          │
    │  GatewayWallet   │
    │  chainId: 5042002│
    │ types:           │
    │  TransferWith-   │
    │  Authorization   │
    │ from, to, value  │
    │ nonce, validity  │
    └─────────────────┘
        │
        ▼
 4. POST /api/send-signed ────► 5. getBalances(from)
    { from, to, amount,             - check Gateway balance
      signedPayload }               - subtract pending intents
                                    │
                                    ▼
                               6. facilitator.verify(
                                    payload, accepted)
                                    │
                                    ▼
                               7. Insert into transactions
                                  status: "pending"
                                    │
                   ◄──────────── { intent_queued }
                                    │
                                    │  ... time passes ...
                                    │
                               8. SETTLE (admin/cron)
                                  fetch all pending
                                    │
                                    ▼
                               9. facilitator.settle(  ──────► On-chain tx
                                    payload, accepted)  ◄────── tx_hash
                                    │
                                    ▼
                               10. Update transactions
                                   status: "settled"
                                   tx_hash: "0x..."
                                    │
                                    ▼
                               11. Push notifications
                                   → sender: "settled"
                                   → recipient: "received"
```

## Merchant Flow Diagram

```
 MERCHANT SERVER              USDC-ME SERVER              CUSTOMER (Browser)
 ───────────────              ──────────────              ──────────────────

 1. POST /api/payments/create
    X-API-Key: usdcme_...
    { amount, description }
        │
        ▼
                         2. Validate API key
                            Generate payment_id
                            Insert payment_requests
                            status: "pending"
                            expires: +30 min
                                │
    ◄────────────────────── { payment_id,
                              payment_url }
        │
        ▼
 3. Show QR code / redirect
    to payment_url
    OR embed widget ─────────────────────────► 4. Customer opens
                                                  /pay/{paymentId}
                                                  │
                                                  ▼
                                               5. Fetch payment details
                                                  (merchant name, amount)
                                                  │
                                                  ▼
                                               6. Sign EIP-712 intent
                                                  (to = merchant wallet)
                                                  │
                                                  ▼
                                               7. POST /api/payments/
                                                  {paymentId}/pay
                                                       │
                                                       ▼
                         8. Check not expired
                            Check payer balance
                            facilitator.verify()
                                │
                                ▼
                         9. Insert transactions
                            type: "merchant_payment"
                            status: "pending"
                            Update payment_requests
                            status: "paid"
                                │
                         ┌──────┴──────┐
                         ▼             ▼
 10. Webhook POST ◄─── callback    postMessage ──────► 11. Customer sees
     { event:           (fire &     to widget              "Payment sent!"
       "payment.        forget)
       completed",
       payment_id,                      ... time passes ...
       amount }
                                        │
                         12. SETTLE (same as P2P)
                             facilitator.settle()
                             for all pending intents
                             (sends + merchant_payments
                              batched together)
```

---

## Flow 1: P2P Transaction (Send USDC)

### 1. Send UI

`components/send-usdc-card.tsx` renders a form with recipient (handle or 0x address) and amount. Validated with Zod. The send button is only enabled when `isUnlocked` is true (both `user` and `privateKey` are in auth context).

### 2. Handle Resolution

`send-usdc-card.tsx` lines 55-72. If the input is already a valid Ethereum address, it returns immediately. Otherwise it strips the `@` prefix and queries the `profiles` table via the browser-side Supabase client:

```typescript
const { data } = await supabase
  .from("profiles")
  .select("handle, wallet_address")
  .eq("handle", handle)
  .single()
```

### 3. Client-Side EIP-712 Signing

`lib/signing.ts` lines 26-69. `signX402Payment()` does the following:

1. Creates a viem wallet account from the private key using `privateKeyToAccount()`.
2. Generates a random 32-byte nonce.
3. Sets `validAfter = now - 600` and `validBefore = now + 345600` (4 days).
4. Signs EIP-712 typed data with domain:

```typescript
domain: {
  name: "GatewayWalletBatched",
  version: "1",
  chainId: 5042002,
  verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" // ARC_GATEWAY_WALLET
}
```

Primary type is `TransferWithAuthorization` with fields: `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce`.

Returns the x402 v2 payload:

```typescript
{ x402Version: 2, payload: { authorization, signature } }
```

### 4. Submit Signed Intent

`lib/api.ts` sends a POST to `/api/send-signed` with the payload:

```typescript
{
  from: "0x...",
  to: "0x...",
  amount: "10",
  signedPayload: { x402Version: 2, payload: { authorization, signature } }
}
```

The `apiFetch` helper attaches the Supabase JWT as a Bearer token.

### 5. Server-Side Verification

`app/api/send-signed/route.ts`:

1. Creates a read-only `GatewayClient` via `createPlatformGateway()` (uses a throwaway random private key).
2. Calls `gateway.getBalances(from)` and subtracts all pending intents to compute true available balance.
3. Builds the `accepted` object with Arc network info, USDC address, and verifying contract.
4. Calls `facilitator.verify(fullPayload, accepted)` using the `BatchFacilitatorClient`. If `!verification.isValid`, returns 400 with `invalidReason`.

### 6. Database Storage

On verification success, inserts into the `transactions` table:

```typescript
{
  id: crypto.randomUUID(),
  type: "send",
  from_address, to_address, amount,
  status: "pending",
  intent_id,
  network: "eip155:5042002",
  payload: fullPayload,   // authorization + signature + resource + accepted
  accepted
}
```

Returns `{ status: "intent_queued", intentId, amount }`.

### 7. Settlement

`app/api/settle/route.ts`. Triggered from the admin dashboard (manual or auto-settle every 30 minutes).

1. Fetches all pending intents where type is `send` or `merchant_payment`.
2. Settles in batches of 500. For each intent: `facilitator.settle(intent.payload, intent.accepted)`.
3. On success: updates status to `"settled"`, stores `tx_hash` and `settlement_id`.
4. On failure: updates status to `"failed"`, stores `error_reason`.
5. Sends web push notifications to senders and recipients.

---

## Flow 2: Merchant Payment

### 1. Merchant Registration

`app/api/merchants/register/route.ts`. Takes `name`, `email`, `wallet_address`. Generates a random 32-byte hex API key prefixed with `usdcme_`:

```typescript
const apiKey = "usdcme_" +
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
```

Inserts into `merchants` table. Returns the API key once, never shown again.

### 2. Payment Creation

`app/api/payments/create/route.ts`. Merchants authenticate via `X-API-Key` header.

1. Validates the API key against the `merchants` table.
2. Generates a URL-safe payment ID (`pay_` prefix + 8 random bytes base64-encoded).
3. Sets expiry to 30 minutes.
4. Inserts into `payment_requests`.
5. Returns `{ payment_id, payment_url, qr_data, amount, status, expires_at }`.

### 3. Payment Page

`app/pay/[paymentId]/page.tsx`. Customer-facing UI.

- Fetches payment details via `GET /api/payments/{paymentId}` (joins `payment_requests` with `merchants` for merchant name).
- Three states: not logged in (shows signup link), logged in but locked (shows password input), logged in and unlocked (shows Pay button).
- Supports embed mode (`?embed=true`) for widget integration via `window.opener.postMessage`.

### 4. Customer Signs Intent

Same `signX402Payment()` from `lib/signing.ts`, but the `payTo` address is the merchant's wallet.

### 5. Server-Side Verification

`app/api/payments/[paymentId]/pay/route.ts`. Nearly identical to the P2P flow:

1. Fetches payment request, validates status is "pending" and not expired.
2. Checks payer's Gateway balance.
3. Calls `facilitator.verify(fullPayload, accepted)`.
4. Inserts into `transactions` with `type: "merchant_payment"`.
5. Updates `payment_requests` to `status: "paid"`.

### 6. Webhook Delivery

After successful verification, fires a non-blocking POST to the merchant's callback URL:

```typescript
{
  event: "payment.completed",
  payment_id, amount, payer_address, intent_id, timestamp
}
```

The callback URL can be set per-payment at creation time or as a default on the merchant account. Per-payment takes priority. 5-second timeout, fire-and-forget.

### 7. Settlement

Merchant payments settle identically to P2P. The settle route queries for both `send` and `merchant_payment` types.

### Embeddable Widget

`public/widget.js` is a drop-in script tag. Merchants embed:

```html
<div id="usdcme-pay" data-payment-id="pay_abc123"></div>
<script src="https://www.usdc-me.xyz/widget.js"></script>
```

The widget opens the payment page in a popup and listens for `usdcme:payment` events via postMessage.

---

## Flow 3: Deposit & Withdrawal

### Deposits

`lib/signing.ts` lines 89-213, `deposit()` function. Entirely client-side, no backend API call.

1. Parses amount with `parseUnits(amount, 6)` (USDC has 6 decimals).
2. Reads USDC balance via `publicClient.readContract()` against the USDC contract at `0x3600000000000000000000000000000000000000`.
3. Checks ERC-20 allowance for the Gateway contract (`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`). If insufficient, approves `MAX_UINT256`. Polls up to 10 times with 2-second intervals for RPC propagation.
4. Re-reads balance after approval (on Arc, gas is paid in USDC, so the approve tx reduces balance). Reserves 100,000 atomic units (0.1 USDC) for the deposit tx gas.
5. Calls `Gateway.deposit(token, value)`:

```typescript
await walletClient.writeContract({
  address: ARC_GATEWAY_WALLET,
  abi: GATEWAY_WALLET_ABI,
  functionName: "deposit",
  args: [ARC_USDC_ADDRESS, depositAmount],
})
```

This is the only on-chain transaction users need to make. After deposit, everything is gasless intents.

### Withdrawals

`app/api/wallet/[address]/withdraw/route.ts`.

1. Creates a `GatewayClient` with the user's private key via `createUserGateway(privateKey)`.
2. Calls `gateway.withdraw(amount, { chain, recipient })`. Circle's SDK handles the cross-chain bridging.
3. Records the withdrawal in `transactions` with status `"settled"` and the `mintTxHash`.

Supported destination chains (from `lib/chains.ts`):
- Arc Testnet, Avalanche Fuji, Base Sepolia, Ethereum Sepolia, HyperEVM Testnet, Sei Atlantic, Solana Devnet, Sonic Testnet, World Chain Sepolia

### Balance Checking

`app/api/wallet/[address]/balance/route.ts`. Uses a read-only `GatewayClient` (throwaway key) to call `gateway.getBalances(address)`. Returns wallet balance and Gateway balance (total and available). Polled every 30 seconds from the `BalanceDisplay` component.

---

## Flow 4: Wallet & Key Management

### Key Generation

`contexts/auth-context.tsx` lines 168-205, during `register()`:

1. `supabase.auth.signUp({ email, password })` creates the auth user.
2. `generatePrivateKey()` from `lib/wallet.ts` generates 32 random bytes via `crypto.getRandomValues()`.
3. `getAddressFromKey()` uses viem's `privateKeyToAccount()` to derive the Ethereum address.
4. The key is encrypted twice (dual-password system) and both blobs are stored in the `profiles` table.

### Encryption (AES-GCM + PBKDF2)

`lib/crypto.ts`.

**Key derivation** (`deriveKey`):
- Algorithm: PBKDF2 with SHA-256
- Iterations: 600,000
- Salt: 16 random bytes (unique per encryption)
- Output: AES-256-GCM key

**Encryption** (`encryptPrivateKey`):
1. Generate 16-byte random salt.
2. Generate 12-byte random IV.
3. Derive AES-256 key from password + salt.
4. Encrypt with AES-GCM.
5. Return `EncryptedKeyBlob`:

```typescript
{
  ciphertext: string,  // base64
  iv: string,          // base64 (12 bytes)
  salt: string,        // base64 (16 bytes)
  version: 1
}
```

**Decryption** (`decryptPrivateKey`): Decode base64 fields, derive key from password + salt, decrypt with AES-GCM.

### Key Storage

- **Server (Supabase `profiles` table):** `encrypted_key_blob` (encrypted with login password) and `recovery_key_blob` (encrypted with recovery password). Both stored as JSON.
- **Browser `sessionStorage`:** Decrypted private key cached under key `"usdc_pk"`. Survives page refreshes, cleared on tab close.

### Key Retrieval on Login

`auth-context.tsx` lines 111-166:

1. Sign in via Supabase auth.
2. Fetch profile with `encrypted_key_blob`.
3. Decrypt with login password.
4. Verify derived address matches `wallet_address`.
5. Cache in sessionStorage and React state.
6. If decryption fails (e.g., password was reset externally), set `needsRecovery = true`.

### Password Recovery (Dual-Password System)

The same private key is encrypted under two passwords: login and recovery.

**Recovery when authenticated** (`recoverWithPassword`, auth-context.tsx lines 208-268):
1. Fetch `recovery_key_blob` from profile.
2. Decrypt with recovery password.
3. Re-encrypt with new login password.
4. Update `encrypted_key_blob` in profile and Supabase auth password.

**Recovery when not authenticated** (`recover`, auth-context.tsx lines 271-349):
1. `POST /api/recover/start` with email. Server returns `recovery_key_blob` and `wallet_address` (no auth required).
2. Client decrypts with recovery password, verifies address.
3. Re-encrypts with new password.
4. `POST /api/recover/complete` with email, new password, new blob. Server updates Supabase auth password and profile.
5. Auto-login with new credentials.

**Changing passwords** (`app/settings/page.tsx`):
- Change login password: verify current password by attempting decryption, re-encrypt with new password, update profile and Supabase auth.
- Change recovery password: same pattern for the `recovery_key_blob` column.

---

## Flow 5: QR Code Payments

### QR Code Generation

`components/qr-code-display.tsx`. Renders on the dashboard. Encodes the user's payment URL:

```typescript
const payUrl = `${window.location.origin}/${handle}` // e.g. https://www.usdc-me.xyz/alice
```

Uses the `qrcode` library to render onto a canvas element. Also provides a "Copy link" button.

### QR Scanner

`components/qr-scanner-dialog.tsx`. Opens a dialog with camera access using `@zxing/browser`'s `BrowserMultiFormatReader`.

On successful scan, `extractDestination()` handles three QR value types:
- Merchant payment URLs (`https://usdc-me.xyz/pay/pay_abc123`) -- navigates to `/pay/pay_abc123`
- User handle URLs (`https://usdc-me.xyz/alice`) -- navigates to `/alice`
- Plain handles (`alice`) -- navigates to `/alice`

### Handle Payment Page

`app/[handle]/page.tsx`. Server-rendered. Queries Supabase for the profile by handle, then renders the `PaymentForm` component.

`components/payment-form.tsx`. Takes `handle` and `recipientAddress` as props. On submit:
1. Signs via `signX402Payment()`.
2. Submits via `api.sendSigned()` to `POST /api/send-signed`.
3. Same verification and storage as the P2P flow.

If not logged in, shows signup link. If logged in but locked, shows password input.
