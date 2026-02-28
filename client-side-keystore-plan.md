# Plan: Client-Side Encrypted Keystore Migration

## Context

Currently the backend generates private keys and stores them in an in-memory Map. The server signs every x402 spend intent and deposit transaction. This means we handle raw private keys — a liability for production.

**Goal:** Move all key generation and signing to the browser. The server never sees or stores raw private keys. Keys are encrypted client-side with the user's password and stored as opaque blobs in the database.

**Dependency:** Another dev is adding JWT auth + DB. This plan defines what we need from them and builds on top of it.

---

## How it works

```
SIGNUP:
  Browser: generatePrivateKey() → encrypt(key, password) → send encrypted blob to server
  Server: store blob in DB (can't decrypt it)

LOGIN:
  Server: return encrypted blob + JWT
  Browser: decrypt(blob, password) → hold raw key in memory for session

SEND:
  Browser: sign x402 payload with decrypted key → send signed payload to server
  Server: facilitator.verify() → store as pending intent

DEPOSIT:
  Browser: sign on-chain tx with viem → send directly to Arc RPC (no backend needed)

SETTLE:
  Server: facilitator.settle() (unchanged — no private key needed)
```

---

## Key finding: SDK is Node-only, but signing is simple

`GatewayClient` uses Node's `crypto.randomBytes` and `Buffer` — can't run in browser. But the actual signing is just EIP-712 typed data via viem (which IS browser-compatible). We replicate ~50 lines of signing logic using viem directly.

The Payment-Signature structure that `facilitator.verify()` expects:
```json
{
  "x402Version": 2,
  "payload": { "authorization": {...}, "signature": "0x..." },
  "resource": { "url": "...", "description": "...", "mimeType": "..." },
  "accepted": { "scheme": "exact", "network": "...", "amount": "...", ... }
}
```

---

## Files to create

### 1. `frontend-test/src/lib/crypto.ts` — Key encryption/decryption
- `encryptPrivateKey(privateKey, password)` → `EncryptedKeyBlob` (salt + iv + ciphertext)
- `decryptPrivateKey(blob, password)` → privateKey hex string
- Uses Web Crypto API: PBKDF2 (600K iterations) + AES-256-GCM
- No external dependencies

### 2. `frontend-test/src/lib/wallet.ts` — Key generation + viem clients
- `generatePrivateKey()` → random Hex key (using `crypto.getRandomValues`, not Node crypto)
- `getAddressFromKey(privateKey)` → Address
- `createClients(privateKey)` → `{ account, publicClient, walletClient }` for Arc Testnet
- Arc Testnet chain definition (chainId 5042002, RPC, USDC address, GatewayWallet address)
- Uses viem (browser-compatible)

### 3. `frontend-test/src/lib/signing.ts` — x402 signing + deposit
- `signX402Payment(privateKey, payTo, amountAtomic, verifyingContract, chainId)` — replicates `BatchEvmScheme.createPaymentPayload()` from SDK lines 62-97
  - Builds EIP-712 TransferWithAuthorization typed data
  - Signs with viem's `account.signTypedData()`
  - Returns `{ x402Version, payload: { authorization, signature } }`
- `deposit(privateKey, amount)` — replicates `GatewayClient.deposit()` from SDK lines 595-648
  - Approves USDC spend on GatewayWallet contract
  - Calls GatewayWallet.deposit(token, value)
  - Pure viem `writeContract` calls, no SDK needed

### 4. `frontend-test/src/context/WalletContext.tsx` — Session state
- React context holding: decrypted privateKey, address, JWT
- `createWallet(password)` → generates key, encrypts, returns blob + address
- `unlockWallet(blob, password)` → decrypts and stores in state
- `lockWallet()` → clears key from memory

---

## Files to modify

### 5. `frontend-test/package.json`
- Add `viem: "^2.0.0"` to dependencies

### 6. `frontend-test/src/main.tsx`
- Wrap `<App />` with `<WalletProvider>`

### 7. `frontend-test/src/App.tsx` — Major rewrite of flows

**Wallet creation:** Instead of calling `POST /api/wallet/create`, generate key in browser, encrypt with password, send encrypted blob + address to auth signup endpoint.

**Deposit:** Instead of calling `POST /api/wallet/:address/deposit`, call the GatewayWallet contract directly from the browser using viem.

**Send:** Instead of calling `POST /api/send`, sign the x402 payload locally using `signX402Payment()`, then send the pre-signed payload to new `POST /api/send-signed` endpoint.

**Balance check:** Still calls backend (no private key needed).

**Settle:** Still calls backend (unchanged).

### 8. `backend/src/index.ts` — Remove key handling, add new endpoint

**Remove:**
- `import { generatePrivateKey } from 'viem/accounts'`
- `const wallets = new Map<...>()`
- `POST /api/wallet/create` endpoint
- `POST /api/send` endpoint (replaced by `/api/send-signed`)
- `GET /x402/pay/:recipientAddress` endpoint (no longer needed — frontend signs directly)
- `POST /api/wallet/:address/deposit` endpoint (moves to frontend)

**Add:**
- `POST /api/send-signed` — accepts `{ from, to, amount, signedPayload }`:
  1. Build the `accepted` payment requirements (same structure we built for 402 responses)
  2. Build `resource` object
  3. Construct full verify payload: `{ ...signedPayload, resource, accepted }`
  4. Call `facilitator.verify(fullPayload, accepted)`
  5. If valid, store as pending intent (same as before)
  6. If invalid, return error

**Keep unchanged:**
- `GET /api/wallet/:address/balance` — rewrite to not need private key (use a platform-level GatewayClient with a dummy key to call `getBalances(targetAddress)`, or call Gateway API directly)
- `POST /api/settle` — no private key needed
- `GET /api/intents` — no change
- `GET /api/settlements` — no change

---

## What the auth dev needs to provide

**Users table columns:**
- `id`, `email`, `password_hash` (standard auth)
- `wallet_address` VARCHAR(42) — the derived address
- `encrypted_key_blob` JSONB — the `{ ciphertext, iv, salt, version }` object

**Endpoints:**
- `POST /api/auth/signup` — accepts `{ email, password, walletAddress, encryptedKeyBlob }`, returns `{ jwt, address }`
- `POST /api/auth/login` — accepts `{ email, password }`, returns `{ jwt, address, encryptedKeyBlob }`

**JWT middleware** on protected endpoints (`/api/send-signed`, `/api/settle`, etc.)

---

## Implementation order

**Phase 1 — Frontend crypto (no backend changes, can parallel with auth dev):**
1. Create `lib/crypto.ts`
2. Create `lib/wallet.ts`
3. Create `lib/signing.ts`
4. Add viem to frontend package.json
5. Create `context/WalletContext.tsx`
6. Update `main.tsx` with provider

**Phase 2 — Wire up frontend flows:**
7. Update App.tsx wallet creation (generate + encrypt in browser)
8. Update App.tsx deposit (direct viem contract calls)
9. Update App.tsx send (sign locally + call `/api/send-signed`)

**Phase 3 — Backend migration:**
10. Add `POST /api/send-signed` endpoint
11. Rewrite balance endpoint to not need private key
12. Remove old endpoints (`/api/wallet/create`, `/api/send`, `/x402/pay`, `/api/wallet/:address/deposit`)
13. Remove wallets Map and generatePrivateKey import

**Phase 4 — Integration with auth (once auth dev delivers):**
14. Wire signup to send encrypted blob
15. Wire login to receive blob + decrypt
16. Add JWT headers to all API calls

---

## Deferred (post-hackathon)
- Client-side withdraw (complex: BurnIntent signing + Gateway API + mint on dest chain)
- Idle timeout / session lock
- Switch PBKDF2 → scrypt/argon2 for better brute-force resistance
- Separate auth password vs encryption password

---

## Verification

1. **Crypto round-trip:** Generate key → encrypt → decrypt → verify same key
2. **Signing format:** Sign a test payload → base64 encode → verify the structure matches what `facilitator.verify()` expects
3. **End-to-end send:** Create wallet in browser → deposit via viem → sign x402 payload → POST to `/api/send-signed` → verify intent appears in `/api/intents` → settle → verify settlement
4. **Key never on server:** Confirm no `privateKey` field ever appears in request bodies (only `signedPayload`)
