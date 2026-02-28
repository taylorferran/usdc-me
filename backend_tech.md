# USDC.me — Backend Technology Breakdown

Everything Circle/x402 we use in the backend, how it works, and why.

---

## Package

```
@circlefin/x402-batching  ^0.1.0-rc.1
```

Private beta SDK from Circle. Installed via Cloudsmith private registry — requires a `CLOUDSMITH_TOKEN` env var and an `.npmrc` pointing to `https://npm.cloudsmith.io/circle/common-private/`.

---

## 1. GatewayClient (client-side SDK)

```ts
import { GatewayClient } from '@circlefin/x402-batching/client'
```

This is the **buyer/sender** class. Each user wallet in our backend gets one. It wraps a viem wallet client and talks to Circle Gateway.

### Constructor

```ts
const gateway = new GatewayClient({
  chain: 'arcTestnet',   // Chain to operate on
  privateKey: '0x...',   // User's private key (we hold these server-side)
})
```

### Methods we use

| Method | What it does | Returns |
|--------|-------------|---------|
| `gateway.deposit(amount)` | Moves USDC from the user's wallet into the Gateway contract. This is required before they can send payments. | `{ depositTxHash, amount, formattedAmount }` |
| `gateway.pay<T>(url)` | Performs the full x402 payment flow — hits the URL, gets 402 back, signs a spend intent, retries with the signature. All automatic. | `{ data, amount, formattedAmount, transaction }` |
| `gateway.getBalances()` | Returns both wallet and Gateway balances for the account. | `{ wallet: { formatted }, gateway: { formattedTotal, formattedAvailable } }` |
| `gateway.withdraw(amount)` | Moves USDC from Gateway balance back to the on-chain wallet. Supports cross-chain. | `{ mintTxHash, formattedAmount, sourceChain, destinationChain }` |

### Properties

- `gateway.address` — the derived wallet address from the private key

### How we use it

We create a GatewayClient per user when they create a wallet, deposit, check balance, or send. Private keys are stored in an in-memory Map — this is a hackathon shortcut. **We hold the keys because GatewayClient needs them to sign spend intents (EIP-3009 TransferWithAuthorization).** Circle Gateway custodies the funds, not the keys. In production you'd use Circle Programmable Wallets (MPC-based, no single party has the full key), a cloud KMS, or client-side signing.

```ts
// Wallet creation
const privateKey = generatePrivateKey(); // from viem
const gateway = new GatewayClient({ chain: 'arcTestnet', privateKey });
wallets.set(gateway.address, { privateKey, address: gateway.address });

// Sending — GatewayClient handles the entire 402 handshake
const result = await senderGateway.pay<T>(
  `http://localhost:3001/x402/pay/${recipientAddress}?amount=${amount}`
);
```

---

## 2. BatchFacilitatorClient (server-side SDK)

```ts
import { BatchFacilitatorClient } from '@circlefin/x402-batching/server'
```

This is the **platform/server** class. One instance for the whole backend. It talks to Circle's Gateway API to verify and settle payments.

### Constructor

```ts
const facilitator = new BatchFacilitatorClient()
```

No config needed — it knows the Gateway API endpoints.

### Methods we use

| Method | What it does | Returns |
|--------|-------------|---------|
| `facilitator.getSupported()` | Fetches all supported payment kinds (networks, assets, verifying contracts) from Gateway. Called once on startup. | `{ kinds: [{ scheme, network, extra }] }` |
| `facilitator.verify(payload, accepted)` | Validates a payment signature is genuine and the signer has sufficient Gateway balance. Does NOT move any funds. | `{ isValid, invalidReason?, payer? }` |
| `facilitator.settle(payload, accepted)` | Submits a verified payment to Gateway for on-chain settlement. Gateway batches these and pays the gas. | `{ success, errorReason?, transaction?, payer? }` |

### How we use it

**Startup** — fetch supported networks so we can build correct 402 responses:
```ts
const supported = await facilitator.getSupported();
supportedKinds = supported.kinds;
const arcKind = supportedKinds.find(k => k.network === 'eip155:5042002');
```

**Verify** — when a signed payment comes in, check it's valid but don't settle yet:
```ts
const verification = await facilitator.verify(decoded, decoded.accepted);
if (!verification.isValid) { /* reject */ }
// Store as pending intent
```

**Settle** — when "Settle Now" is pressed, batch-settle all pending intents:
```ts
for (const intent of pendingIntents) {
  const result = await facilitator.settle(intent.payload, intent.accepted);
}
```

---

## 3. The x402 Protocol (HTTP 402 Payment Flow)

x402 is an HTTP-native payment protocol. The flow:

### Step 1 — Server returns 402

Client hits a protected endpoint with no payment. Server responds with `402 Payment Required` containing what it accepts:

```json
{
  "x402Version": 2,
  "resource": {
    "url": "http://localhost:3001/x402/pay/0xRecipient?amount=1.00",
    "description": "Send 1.00 USDC to 0xRecipient",
    "mimeType": "application/json"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:5042002",
    "asset": "0x3600000000000000000000000000000000000000",
    "amount": "1000000",
    "maxTimeoutSeconds": 345600,
    "payTo": "0xRecipient",
    "extra": {
      "name": "GatewayWalletBatched",
      "version": "1",
      "verifyingContract": "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"
    }
  }]
}
```

This goes in both the response body AND a base64-encoded `PAYMENT-REQUIRED` header.

### Step 2 — Client signs and retries

`GatewayClient.pay()` handles this automatically. It:
1. Reads the 402 response
2. Signs an EIP-3009 `TransferWithAuthorization` using the user's private key
3. Retries the same URL with a `Payment-Signature` header (base64-encoded signed payload)

### Step 3 — Server verifies (and optionally settles)

We decode the signature, call `facilitator.verify()`, and either:
- **Verify-only** (our approach): Store as a pending intent, settle later in a batch
- **Verify-and-settle**: Call `facilitator.settle()` immediately (what `createGatewayMiddleware` does)

On success, server returns `200` with a base64-encoded `PAYMENT-RESPONSE` header.

### Why verify-then-settle?

Batching. Instead of settling every payment immediately on-chain, we queue them and settle in bulk. This is the whole point of the Gateway batching system — Circle Gateway combines multiple settlements into fewer on-chain transactions. The platform (us) doesn't pay gas; Circle Gateway does.

---

## 4. Key Architecture Decisions

### Server-side signing (hackathon approach)

All private keys live on our backend. `GatewayClient` is instantiated server-side with each user's private key. Users just click "Send" — no crypto UX at all.

**Production approach — client-side encrypted keystore:** Generate a random private key in the browser on signup, encrypt it with a key derived from the user's password (scrypt/argon2), store only the encrypted blob on the server. On login, server sends the blob, browser decrypts locally, signs intents client-side. Server never sees the raw key. UX is identical — same button, same flow — just more plumbing behind the scenes.

### Self-calling x402

Our `/api/send` endpoint creates a `GatewayClient` and calls `gateway.pay()` against our own `/x402/pay/:address` endpoint. The server talks to itself:

```
POST /api/send  →  GatewayClient.pay()  →  GET /x402/pay/:recipient (402)
                                         →  GET /x402/pay/:recipient (with signature)
                                         →  facilitator.verify()
                                         →  stored as pending intent
```

### Gateway balance model

```
User's Wallet  ──deposit──▶  Gateway Balance  ──settle──▶  Recipient's Gateway Balance
                                                               │
                                                           withdraw
                                                               │
                                                               ▼
                                                     Recipient's Wallet
```

Funds flow: wallet → Gateway (deposit) → Gateway (via x402 settle) → wallet (withdraw). After settlement, funds are in the recipient's **Gateway balance**, not their wallet. They need to withdraw to get on-chain USDC back.

---

## 5. Arc Testnet Configuration

| Config | Value |
|--------|-------|
| Chain name | `arcTestnet` |
| Chain ID | `5042002` |
| CAIP-2 network | `eip155:5042002` |
| USDC address | `0x3600000000000000000000000000000000000000` |
| GatewayWallet contract | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| RPC | `https://rpc.testnet.arc.network` |

Arc Testnet was chosen because it has fast finality (~0.5s), USDC-native gas, and is Circle's designated liquidity hub chain.

---

## 6. Also Available (not yet used)

### createGatewayMiddleware

```ts
import { createGatewayMiddleware } from '@circlefin/x402-batching/server'
```

Drop-in Express middleware that handles the full 402 flow for a fixed seller address and price. We don't use it because we need dynamic recipient addresses and amounts per payment — it's designed for simpler "pay $0.01 to access this API" use cases.

### Cross-chain withdraw

`gateway.withdraw(amount, { chain: 'baseSepolia', recipient: '0x...' })` can withdraw USDC to a different chain than Arc. Gateway handles the bridging. Not yet exposed in our API.

### Error codes from Gateway

`unsupported_scheme`, `unsupported_network`, `invalid_signature`, `invalid_payload`, `address_mismatch`, `amount_mismatch`, `insufficient_balance`, `nonce_already_used`, `authorization_expired` — all returned as `invalidReason` from verify or `errorReason` from settle.

---

## 7. Environment Setup

```bash
# .env
CLOUDSMITH_TOKEN=xxx   # Required for npm install of @circlefin/x402-batching
PORT=3001              # Server port

# .npmrc
@circlefin:registry=https://npm.cloudsmith.io/circle/common-private/
//npm.cloudsmith.io/circle/common-private/:_authToken=${CLOUDSMITH_TOKEN}
```

```bash
npm run install:sdk   # installs @circlefin/x402-batching with token auth
npm run dev           # tsx watch src/index.ts
```
