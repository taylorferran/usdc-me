# USDC.me — Project Plan (v4: Zero Web3 UX)

**Hackathon:** Encode × Arc Enterprise & DeFi Hackathon
**Bounty:** Best Chain Abstracted USDC Apps Using Arc as a Liquidity Hub
**Prize pool:** $10,000
**Note:** Arc is currently testnet-only. Everything runs on testnets. Testnet USDC is free from Circle's faucet — no real money needed.

---

## What We're Building

A universal payment handle for USDC — like Venmo but powered by Circle and Arc. You sign up with email, pick a handle (`@alice`), and get a QR code. Anyone else on the platform can pay you by scanning your code or typing your handle. Tap a button, done.

No wallets. No gas. No chain selection. No signing popups. The blockchain is completely invisible.

Under the hood: every user has a Circle developer-controlled wallet on Arc. Payments are off-chain x402 spend intents signed server-side, batch-settled on Arc via Gateway. Cross-chain deposits and withdrawals happen through Gateway. The user never sees any of it.

**One handle. One tap. Every chain. Actually instant.**

---

## Why It Wins

- **Judges can try it live.** Sign up on their phone, scan a QR code, tap pay. No MetaMask, no testnet tokens, no setup.
- **Uses every required tool:** Arc, USDC, Circle Wallets, Circle Gateway — plus the x402 Batching SDK (Circle's newest product, early access).
- **The chain abstraction is total.** Not just "you don't need to pick a chain" — the user doesn't even know they're on a blockchain.
- **x402 SDK used properly.** Spend intents are real cryptographic artifacts signed by Circle wallet keys, validated by SDK middleware, settled in batch via `BatchFacilitatorClient.settle()`. We're demonstrating the full nanopayment pattern Circle designed.
- **It's a real product.** Not a hackathon toy. This is the Venmo/Cash App UX that crypto payments have always promised but never delivered.

---

## How It Works (Simple Version)

### User Experience

1. **Sign up** with email + password. Pick a handle. You immediately have a funded account (testnet faucet).
2. **Pay someone** — scan their QR code or type their @handle. Enter an amount. Tap "Pay." Done. Sub-second.
3. **Get paid** — share your QR code or link. Payments appear in your balance instantly.
4. **Withdraw** — tap "Withdraw," pick a chain, enter an address. USDC appears on that chain.

That's it. That's the whole user experience.

### What Happens Under the Hood

1. **Sign up** → Circle Wallets API creates a developer-controlled wallet on Arc Testnet. Faucet funds it with testnet USDC. Backend deposits the USDC into Gateway. User is ready.
2. **Pay** → Backend authenticates the user (JWT), signs an x402 spend intent server-side using the sender's Circle wallet key, submits it through the SDK middleware. Recipient balance credits instantly. No on-chain transaction.
3. **Get paid** → SDK middleware validates the spend intent. Our code credits the recipient's balance and pushes a real-time notification.
4. **Settle** → Periodically (or on-demand), backend calls `BatchFacilitatorClient.settle()`. All pending intents get settled on-chain on Arc in a single batch. The SDK handles all Gateway mechanics.
5. **Withdraw** → Backend calls `GatewayClient.withdraw()`. Gateway mints USDC on the recipient's chosen chain. One SDK call.

### The x402 Story (For Judges)

Even though the user never sees it, every payment is a real x402 spend intent:

- Signed with EIP-3009 `TransferWithAuthorization` using the sender's Circle wallet key
- Validated by `createGatewayMiddleware` on our Express server
- Backed by real Gateway deposits (USDC locked in Gateway contracts on Arc)
- Settled in batch via `BatchFacilitatorClient.settle()` on Arc
- Withdrawable to any of 9 chains via `GatewayClient.withdraw()`

The x402 protocol is the engine. We just put a Venmo dashboard on top.

---

## Architecture: SDK vs Our Code

### What the x402 Batching SDK handles

| SDK Component | What It Does |
|---|---|
| `createGatewayMiddleware` | Express middleware: handles 402 negotiation and signature validation on our payment endpoint |
| `GatewayClient.pay()` | Signs spend intents (we call this server-side with Circle wallet keys) |
| `BatchFacilitatorClient.settle()` | Submits batched settlement to Gateway — handles burn/attest/mint on Arc |
| `GatewayClient.withdraw()` | Cross-chain withdrawal in one call — handles settlement + Gateway transfer + mint |
| `GatewayClient` | Balance queries, deposit helpers |

### What we build

| Our Component | What It Does |
|---|---|
| **Auth system** | Email/password registration, login, JWT sessions |
| **Handle registry** | Maps `@alice` → user record → Circle wallet address |
| **Auto-funding** | On registration: faucet → wallet → Gateway deposit (testnet only) |
| **Payment API** | Authenticated endpoint that resolves handles and triggers server-side x402 signing |
| **Dashboard** | Balance display, transaction history, settlement status |
| **Settlement trigger** | Cron job + "Settle Now" button calling `settle()`, logs results |
| **Withdrawal UI** | User picks chain + amount, we call `withdraw()`, show result |
| **QR codes** | Generated per handle, link to payment page |
| **Real-time updates** | WebSocket push when payments received |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       USDC.me SYSTEM (v4)                            │
│                                                                      │
│  ┌─────────────┐    ┌───────────────────────────┐    ┌───────────┐  │
│  │             │    │  Our Backend (Express)     │    │           │  │
│  │  Frontend   │    │                            │    │  Circle   │  │
│  │  (React)    │    │  ┌──────────────────────┐  │    │  Gateway  │  │
│  │             │    │  │ OUR CODE:            │  │    │  (on-     │  │
│  │  • Login    │    │  │                      │  │    │  chain)   │  │
│  │  • Register │    │  │  Auth (JWT)          │  │    │           │  │
│  │  • Pay page │    │  │  Handle registry     │  │    │           │  │
│  │  • Dashboard│◄──►│  │  Payment routing     │  │◄──►│           │  │
│  │  • QR codes │    │  │  Transaction log     │  │    │  Circle   │  │
│  │  • Withdraw │    │  │  Settlement trigger   │  │    │  Wallets  │  │
│  │             │    │  │  Auto-funding         │  │    │  (Arc)    │  │
│  │  No wallet  │    │  │  WebSocket server     │  │    │           │  │
│  │  connect.   │    │  └──────────┬───────────┘  │    │  USDC     │  │
│  │  No signing.│    │             │              │    │  Faucet   │  │
│  │  No crypto. │    │             ▼              │    │  (test)   │  │
│  │             │    │  ┌──────────────────────┐  │    │           │  │
│  │             │    │  │ SDK LAYER:           │  │    │           │  │
│  │             │    │  │                      │  │    │           │  │
│  │             │    │  │ GatewayClient        │──┼───►│           │  │
│  │             │    │  │ createGatewayMW      │  │    │           │  │
│  │             │    │  │ BatchFacilitator     │  │    │           │  │
│  │             │    │  │ Client               │  │    │           │  │
│  │             │    │  └──────────────────────┘  │    │           │  │
│  └─────────────┘    └───────────────────────────┘    └───────────┘  │
│                                                                      │
│     Pure React            Node.js                      Blockchain    │
│  (no web3 libraries)   (all crypto here)                             │
└─────────────────────────────────────────────────────────────────────┘
```

Note: the frontend has **zero web3 dependencies**. No wagmi, no ethers, no RainbowKit, no viem on the client side. It's a standard React app that talks to our REST API with JWT auth. All blockchain interaction happens in the backend.

---

## User Flows

### Flow 1: Registration

```
 User                    Frontend               Backend              Circle
  │                         │                       │                   │
  │  Sign up:               │                       │                   │
  │  email: bob@mail.com    │                       │                   │
  │  password: ****         │                       │                   │
  │  handle: bob            │                       │                   │
  │────────────────────────►│                       │                   │
  │                         │  POST /api/register   │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  1. Validate handle   │                   │
  │                         │     (unique, format)  │                   │
  │                         │                       │                   │
  │                         │  2. Hash password     │                   │
  │                         │     (bcrypt)          │                   │
  │                         │                       │                   │
  │                         │  3. Create wallet     │                   │
  │                         │     on Arc Testnet    │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  wallet_id,       │
  │                         │                       │  address: 0xB2..  │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  4. Fund from faucet  │                   │
  │                         │     (testnet: $10)    │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  USDC in wallet   │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  5. Deposit into      │                   │
  │                         │     Gateway on Arc    │                   │
  │                         │     (0.5s finality)   │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  Gateway balance  │
  │                         │                       │  confirmed: $10   │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  6. Save to DB        │                   │
  │                         │  7. Generate QR code  │                   │
  │                         │  8. Return JWT        │                   │
  │                         │                       │                   │
  │  "Welcome @bob!"        │  {jwt, handle, qr,    │                   │
  │  Balance: $10.00        │   balance: 10}        │                   │
  │◄────────────────────────│◄──────────────────────│                   │
```

The user signs up and is immediately ready to send and receive. No setup, no faucet hunting, no "connect wallet" step.

Steps 4-5 (faucet + Gateway deposit) happen server-side during registration. The user just sees a brief loading state, then their funded dashboard.

**For production:** step 4 would be replaced by the user transferring USDC to their wallet address, or a fiat on-ramp. For testnet, the faucet is free and instant.


### Flow 2: Payment (The Core Flow)

@bob pays @alice $5. No blockchain interaction. No signing popups.

```
 @bob (phone)             Frontend               Backend              SDK
  │                          │                       │                   │
  │  Scans @alice's QR       │                       │                   │
  │  (or types @alice)       │                       │                   │
  │  Enters $5               │                       │                   │
  │  Taps "Pay"              │                       │                   │
  │─────────────────────────►│                       │                   │
  │                          │  POST /api/pay/@alice │                   │
  │                          │  Auth: Bearer <jwt>   │                   │
  │                          │  {amount: 5}          │                   │
  │                          │─────────────────────►│                   │
  │                          │                       │                   │
  │                          │  1. Verify JWT        │                   │
  │                          │     → This is @bob    │                   │
  │                          │                       │                   │
  │                          │  2. Resolve @alice    │                   │
  │                          │     → wallet 0xA1..   │                   │
  │                          │                       │                   │
  │                          │  3. Check @bob's      │                   │
  │                          │     available balance │                   │
  │                          │     → $10 available   │                   │
  │                          │                       │                   │
  │                          │  4. Sign x402 spend   │                   │
  │                          │     intent SERVER-    │                   │
  │                          │     SIDE using @bob's │                   │
  │                          │     Circle wallet key │                   │
  │                          │─────────────────────────────────────────►│
  │                          │                       │                   │
  │                          │  5. SDK middleware     │                   │
  │                          │     validates intent  │                   │
  │                          │◄─────────────────────────────────────────│
  │                          │                       │                   │
  │                          │  6. Log transaction   │                   │
  │                          │  7. Credit @alice     │                   │
  │                          │  8. Debit @bob        │                   │
  │                          │  9. WS push to Alice  │                   │
  │                          │                       │                   │
  │                          │  {status: "paid",     │                   │
  │                          │   balance: 5}         │                   │
  │                          │◄─────────────────────│                   │
  │                          │                       │                   │
  │  "Paid @alice $5! ✅"    │                       │                   │
  │  New balance: $5.00      │                       │                   │
  │◄─────────────────────────│                       │                   │
  │                          │                       │                   │
  │       Meanwhile, on Alice's laptop:              │                   │
  │       Dashboard updates via WebSocket:           │                   │
  │       "💰 $5 from @bob"                          │                   │
```

From the user's perspective: type amount → tap → done. The x402 machinery is invisible but real. Every payment is a cryptographically signed spend intent backed by Gateway deposits.


### Flow 3: Batch Settlement

Backend housekeeping. Users don't see this (except in the dashboard status column). For the demo, we trigger it manually.

```
 Our Code                   SDK                      Gateway / Arc
  │                           │                            │
  │  [Cron or "Settle Now"]   │                            │
  │                           │                            │
  │  BatchFacilitatorClient   │                            │
  │  .settle()                │                            │
  │──────────────────────────►│                            │
  │                           │  SDK handles:              │
  │                           │  • Collects pending        │
  │                           │    spend intents           │
  │                           │  • Submits batch to        │
  │                           │    Gateway                 │
  │                           │  • Settlement executes     │
  │                           │    on Arc Testnet          │
  │                           │───────────────────────────►│
  │                           │                            │
  │                           │  Result: settled           │
  │                           │◄───────────────────────────│
  │                           │                            │
  │  {txHash, settledCount,   │                            │
  │   totalAmount}            │                            │
  │◄──────────────────────────│                            │
  │                           │                            │
  │  OUR CODE:                │                            │
  │  • Log settlement         │                            │
  │  • Mark txns as settled   │                            │
  │  • Update dashboards      │                            │
  │  • Show in admin:         │                            │
  │    "5 intents → 1 tx"     │                            │
```


### Flow 4: Withdrawal

Alice wants USDC on Avalanche. One SDK call.

```
 @alice                  Frontend               Backend
  │                         │                       │
  │  Dashboard → Withdraw   │                       │
  │  Amount: $20            │                       │
  │  Chain: Avalanche       │                       │
  │  Address: 0xMyAvax...   │                       │
  │  Taps "Withdraw"        │                       │
  │────────────────────────►│                       │
  │                         │  POST /api/withdraw   │
  │                         │  Auth: Bearer <jwt>   │
  │                         │  {amount: 20,         │
  │                         │   chain: "avaxFuji",  │
  │                         │   address: "0x..."}   │
  │                         │──────────────────────►│
  │                         │                       │
  │                         │  GatewayClient        │
  │                         │  .withdraw(20, {      │
  │                         │    chain: 'avaxFuji', │
  │                         │    to: '0xMyAvax'     │
  │                         │  })                   │
  │                         │                       │
  │                         │  SDK handles:          │
  │                         │  • Settle pending      │
  │                         │  • Gateway transfer    │
  │                         │  • Cross-chain mint    │
  │                         │                       │
  │                         │  {txHash, status}      │
  │                         │◄──────────────────────│
  │                         │                       │
  │  "Withdrew $20 to       │                       │
  │   Avalanche! ✅"        │                       │
  │  tx: 0xdef...           │                       │
  │◄────────────────────────│                       │
```


### Flow 5: Fund Account (Add More Balance)

For testnet: tap a button, free USDC from faucet.

```
 @bob                    Frontend               Backend              Circle
  │                         │                       │                   │
  │  Dashboard → "Add Funds"│                       │                   │
  │  Taps "Get Testnet USDC"│                       │                   │
  │────────────────────────►│                       │                   │
  │                         │  POST /api/fund       │                   │
  │                         │  Auth: Bearer <jwt>   │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  1. Call faucet API   │                   │
  │                         │     for @bob's wallet │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  USDC delivered   │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  2. Deposit into      │                   │
  │                         │     Gateway on Arc    │                   │
  │                         │     (0.5s)            │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  Balance updated  │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │  Balance: $20.00        │  {new_balance: 20}    │                   │
  │  (was $10)              │◄──────────────────────│                   │
  │◄────────────────────────│                       │                   │
```

For production this would be: transfer USDC from an external wallet to your USDC.me wallet address, or buy via fiat on-ramp. For the hackathon, the faucet button is all we need.

---

## Features (Priority Order)

### Must Have (Saturday)

1. **Auth system** — email/password registration, login, JWT sessions, bcrypt
2. **Handle registration** — pick a unique handle, Circle Wallets API creates developer-controlled wallet on Arc Testnet
3. **Auto-funding** — on registration, faucet funds the wallet, backend deposits into Gateway. User is immediately ready.
4. **Payment page** — `usdc.me/@alice` with amount input. Logged-in users see a "Pay" button. Unauthenticated users see "Sign up to pay."
5. **Server-side x402 payment** — backend signs spend intent with sender's Circle wallet key, SDK middleware validates, logs transaction, credits recipient
6. **QR code** — per handle, links to payment page
7. **Balance display** — current available balance on dashboard

### Should Have (Sunday Morning)

8. **Settlement trigger** — "Settle Now" button calling `BatchFacilitatorClient.settle()` + display of result (intent count, tx hash)
9. **Transaction history** — list of sent/received payments with amounts, handles, timestamps, status (pending/settled)
10. **Withdraw to any chain** — user enters destination chain + address, backend calls `GatewayClient.withdraw()`
11. **Real-time updates** — WebSocket push to recipient dashboard on payment received

### Nice to Have (Sunday Afternoon)

12. **Netting visualization** — show "X intents → Y on-chain txs" in settlement UI
13. **"Add Funds" button** — tap to request more testnet USDC from faucet
14. **Public profile** — name, avatar on payment page
15. **Payment notes** — "for coffee ☕" attached to payments

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React + TypeScript | Standard React app. **No web3 libraries on client.** |
| Backend | Node.js + Express | Auth, handle registry, payment routing, settlement, all SDK interaction |
| Auth | bcrypt + jsonwebtoken | Email/password → hashed password → JWT sessions |
| Database | SQLite (better-sqlite3) | Users, transactions, settlements, withdrawals |
| Wallets | Circle Wallets API (developer-controlled) | Each user gets a wallet on Arc Testnet. Backend holds all keys. |
| Payments | x402 Batching SDK (server-side) | `createGatewayMiddleware`, `GatewayClient.pay()` signed server-side |
| Settlement | x402 Batching SDK | `BatchFacilitatorClient.settle()` |
| Withdrawals | x402 Batching SDK | `GatewayClient.withdraw()` |
| Funding | Circle Faucet API | Testnet only — auto-fund on registration |
| QR codes | `qrcode` npm package | Generate from payment link |
| Real-time | ws (WebSocket) | Push payment notifications to recipients |
| Deploy | Vercel (frontend) + Railway (backend) | Free tier |

### Frontend Dependencies (Minimal)

```json
{
  "dependencies": {
    "react": "^18",
    "react-router-dom": "^6",
    "qrcode.react": "^3"
  }
}
```

No wagmi. No ethers. No viem. No RainbowKit. No web3 libraries at all on the client. This is a standard React app that talks to a REST API.

### Backend Dependencies

```json
{
  "dependencies": {
    "@circlefin/x402-batching": "latest",
    "@x402/core": "latest",
    "viem": "latest",
    "@circle-fin/developer-controlled-wallets": "latest",
    "express": "^4",
    "better-sqlite3": "^9",
    "bcrypt": "^5",
    "jsonwebtoken": "^9",
    "ws": "^8",
    "qrcode": "^1",
    "cors": "^2",
    "dotenv": "^16"
  }
}
```

All crypto lives on the backend.

---

## Circle Products We're Using

| Product | What For | How |
|---|---|---|
| **Arc (Testnet)** | Hub chain — all wallets, settlements, and deposits live here | Fastest finality (0.5s), USDC-native gas |
| **USDC (Testnet)** | The only currency in the app | Free from faucet.circle.com |
| **Circle Wallets** | Every user gets a developer-controlled wallet on Arc | Created via REST API at registration |
| **Circle Gateway** | Deposits, batch settlement, cross-chain withdrawals | Accessed through x402 Batching SDK |
| **x402 Batching SDK** | Off-chain spend intents, 402 middleware, batch settlement | The payment engine — signed server-side |
| **Circle Faucet** | Auto-fund new users with testnet USDC | Called at registration (testnet only) |

---

## Server-Side x402: How It Works

This is the most unusual part of the architecture, so here's the detail.

The x402 SDK is designed for client-side wallet signing (browser wallet signs spend intents). We're using it server-side because our backend holds the Circle wallet keys. The SDK doesn't care who signs — it validates the signature regardless.

### The Payment Endpoint (Pseudocode)

```javascript
import { createGatewayMiddleware } from '@circlefin/x402-batching';
import { GatewayClient } from '@circlefin/x402-batching';

// Gateway client configured with our Circle API credentials
const gateway = new GatewayClient({ /* config */ });

// x402 middleware on the payment route
const paymentMiddleware = createGatewayMiddleware({ /* config */ });

app.post('/api/pay/:handle', authMiddleware, async (req, res) => {
  const sender = req.user;              // from JWT
  const { amount } = req.body;

  // 1. Resolve recipient handle
  const recipient = await db.getUserByHandle(req.params.handle);
  if (!recipient) return res.status(404).json({ error: 'User not found' });

  // 2. Check sender balance
  const balance = await gateway.getBalance(sender.wallet_address);
  if (balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  // 3. Sign x402 spend intent SERVER-SIDE
  //    using sender's Circle developer-controlled wallet
  const paymentResult = await gateway.pay({
    to: recipient.wallet_address,
    amount: amount,
    signerKey: await getCircleWalletKey(sender.wallet_id),
  });

  // 4. Log transaction
  await db.logTransaction({
    from_handle: sender.handle,
    to_handle: recipient.handle,
    amount: amount,
    intent_id: paymentResult.intentId,
    status: 'pending',
  });

  // 5. Update cached balances
  await updateBalance(sender.handle, -amount);
  await updateBalance(recipient.handle, +amount);

  // 6. Notify recipient
  wsNotify(recipient.handle, {
    type: 'payment_received',
    from: sender.handle,
    amount: amount,
  });

  res.json({
    status: 'paid',
    to: recipient.handle,
    amount: amount,
    new_balance: balance - amount,
  });
});
```

### Why Server-Side x402 Still Matters

Even though we could skip x402 and just do ledger debits (since we control both wallets), using x402 is important:

1. **Real cryptographic intents.** Every payment is a signed EIP-3009 `TransferWithAuthorization`. These are real, verifiable, backed by Gateway deposits. Not just a database entry.
2. **Settlement works.** `BatchFacilitatorClient.settle()` expects real spend intents. If we skip x402, we can't use the SDK's settlement.
3. **Judges see proper SDK usage.** The x402 Batching SDK is what Circle wants people to build with. Using it correctly — even server-side — shows we understand the product.
4. **Future-proof.** If we later add external wallet support (unregistered senders), the x402 infrastructure is already in place.

---

## Data Model

```
DATABASE SCHEMA
═══════════════

users
├── id              (TEXT, UUID)
├── handle          (TEXT, unique, e.g. "alice")
├── email           (TEXT, unique)
├── password_hash   (TEXT, bcrypt)
├── wallet_id       (TEXT, Circle wallet ID)
├── wallet_address  (TEXT, 0x on Arc)
├── created_at      (TEXT, ISO timestamp)

transactions
├── id              (TEXT, UUID)
├── from_handle     (TEXT, sender)
├── to_handle       (TEXT, recipient)
├── amount          (REAL, USDC)
├── intent_id       (TEXT, x402 spend intent ID from SDK)
├── status          (TEXT: pending | settled)
├── settlement_id   (TEXT, FK → settlements, null until settled)
├── created_at      (TEXT, ISO timestamp)

settlements
├── id              (TEXT, UUID)
├── intent_count    (INTEGER)
├── total_amount    (REAL, total USDC settled)
├── tx_hash         (TEXT, on-chain settlement tx)
├── trigger         (TEXT: cron | manual | withdrawal)
├── created_at      (TEXT, ISO timestamp)

withdrawals
├── id              (TEXT, UUID)
├── handle          (TEXT)
├── amount          (REAL)
├── destination     (TEXT, chain name)
├── dest_address    (TEXT, 0x on destination chain)
├── tx_hash         (TEXT, mint tx on destination)
├── status          (TEXT: processing | completed | failed)
├── created_at      (TEXT, ISO timestamp)
```

Simpler than any previous version. No `gateway_deposits` table, no `spend_intents` with nonce/signature columns, no `balances` materialized view. The SDK tracks Gateway state. We track product state.

---

## API Endpoints

```
AUTH
════

POST   /api/register
       Body: { email, password, handle }
       → Creates user, Circle wallet, funds from faucet, deposits to Gateway
       → { jwt, handle, balance, qr_code_url, pay_link }

POST   /api/login
       Body: { email, password }
       → { jwt, handle, balance }


PAYMENT
═══════

POST   /api/pay/:handle
       Auth: Bearer <jwt>
       Body: { amount }
       → Signs x402 spend intent server-side
       → Validates via SDK middleware
       → Logs transaction, credits recipient
       → { status, to_handle, amount, new_balance }

GET    /api/user/:handle
       → { handle, pay_link, qr_code_url }
       (Public — used by payment page to show recipient info)


DASHBOARD (authenticated)
═════════════════════════

GET    /api/dashboard
       Auth: Bearer <jwt>
       → { handle, balance, pending_received, settled_received,
           recent_transactions: [...] }

GET    /api/transactions
       Auth: Bearer <jwt>
       → [ { type: "sent"|"received", handle, amount, status, timestamp } ]


WITHDRAWAL (authenticated)
══════════════════════════

POST   /api/withdraw
       Auth: Bearer <jwt>
       Body: { amount, chain, address }
       → Calls GatewayClient.withdraw()
       → { tx_hash, status }


FUNDING (authenticated, testnet only)
═════════════════════════════════════

POST   /api/fund
       Auth: Bearer <jwt>
       → Calls faucet API → deposits to Gateway
       → { new_balance }


SETTLEMENT (admin / demo)
═════════════════════════

POST   /api/settle
       → Calls BatchFacilitatorClient.settle()
       → { settlement_id, intent_count, total_amount, tx_hash }
```

---

## Weekend Schedule

### Saturday

| Time | Task | Who |
|---|---|---|
| **Morning (2 hrs)** | **SDK FIRST:** Get `examples/basic-paywall` running. Deposit, pay, settle. Understand how `GatewayClient.pay()` works so we can use it server-side. | Everyone |
| **Morning (2 hrs)** | Auth system: register, login, JWT, bcrypt. Circle Wallets integration: create developer-controlled wallet on registration. Database schema. | Backend |
| **Morning (2 hrs)** | React app scaffold. Login/register pages. Dashboard layout. QR code generation. | Frontend |
| **Afternoon (2 hrs)** | Auto-funding pipeline: faucet API → wallet → Gateway deposit on Arc. Test that a new user is immediately funded. | Backend |
| **Afternoon (2 hrs)** | Payment page: resolve handle, show recipient info, amount input, "Pay" button. | Frontend |
| **Afternoon (2 hrs)** | Server-side x402 payment flow: sign spend intent with Circle wallet key, SDK middleware validation, transaction logging, balance updates. | Backend |
| **Afternoon (2 hrs)** | Connect payment UI to backend. Balance display. Basic dashboard with balance. | Frontend |
| **Evening (2 hrs)** | End-to-end test: register @alice + @bob → @bob pays @alice → Alice sees balance update | Everyone |

### Sunday

| Time | Task | Who |
|---|---|---|
| **Morning (2 hrs)** | Settlement engine: `BatchFacilitatorClient.settle()`, "Settle Now" endpoint, cron job (if time), log results. | Backend |
| **Morning (2 hrs)** | Withdrawal endpoint: `GatewayClient.withdraw()`, validation, logging. | Backend |
| **Morning (4 hrs)** | Transaction history page. Settlement status on transactions. Withdraw UI. "Add Funds" button. Polish, responsive, loading states. | Frontend |
| **Afternoon (2 hrs)** | WebSocket: push payment notifications to recipient dashboard in real-time. | Backend + Frontend |
| **Afternoon (2 hrs)** | Architecture diagram, documentation, Circle Product Feedback draft. | Everyone |
| **Afternoon (2 hrs)** | Pre-fund demo accounts. Record demo video. Practice live demo. | Everyone |

### Saturday Evening Milestone

By Saturday evening, the core loop must work:

```
Register → Login → Pay @someone → They see it → Balance updates
```

If this works, everything else is polish. If it doesn't, Sunday is for fixing it.

---

## Demo Script (2 Minutes)

**Setup (done backstage):**
- Pre-register @demo (laptop) and @sender (phone)
- Both auto-funded with $50 testnet USDC via faucet
- Both logged in and ready

**The demo:**

1. **(0:00)** Show USDC.me on laptop. Logged in as @demo. Show QR code.

   *"This is USDC.me. I signed up with email and a handle. No wallets, no MetaMask, no seed phrases. Just email and a username."*

2. **(0:15)** Pick up phone. Already logged in as @sender. Scan @demo's QR code. Payment page loads. Type $5.

   *"My friend wants to pay me. They scan my QR, type an amount..."*

3. **(0:25)** Tap "Pay." ✅ Instant.

   Laptop dashboard updates: "💰 $5 from @sender"

   *"Done. That was a real x402 spend intent — signed, validated, backed by a Gateway deposit — but the user just tapped a button."*

4. **(0:40)** Two more rapid payments: $3, then $8.

   ✅ Balance ticks up each time. $5 → $8 → $16.

   *"Every payment is a signed spend intent. Off-chain. Instant. No gas. I can stack them all day."*

5. **(0:55)** Switch to settlement view on laptop.

   *"These three payments are off-chain right now. Watch."*

   Click "Settle Now."

   Show result: "3 intents settled. 1 on-chain transaction on Arc. Hash: 0xabc..."

   *"Three payments. One transaction on Arc. That's batch settlement via the x402 SDK and Circle Gateway."*

6. **(1:15)** Click "Withdraw" → $10 → Avalanche Fuji → enter address.

   *"Now I want my money on a different chain."*

   Tap "Withdraw." Tx hash appears.

   *"Gateway mints USDC on Avalanche. Any of nine testnet chains."*

7. **(1:35)** Wrap up.

   *"The user experience is email signup and a pay button. The infrastructure is x402 spend intents, Circle developer-controlled wallets, batch settlement on Arc, cross-chain withdrawal via Gateway.*

   *Zero Web3 UX. Full x402 pipeline. Arc as the liquidity hub.*

   *That's USDC.me."*

8. **(2:00)** End.

### Why This Demo Kills

- **No "let me connect my wallet" moment.** Judges don't need MetaMask. They don't need to understand what signing means. They see: sign up, scan QR, tap pay. Done.
- **Rapid-fire payments.** Three payments in 15 seconds shows the off-chain model viscerally.
- **Settlement visualization.** "3 intents → 1 tx" is the technical punchline. Proves Arc-as-hub and x402 batching in one moment.
- **Cross-chain withdrawal.** Completes the story: any chain in, any chain out.
- **The pitch line writes itself:** "Zero Web3 UX. Full x402 pipeline." That's the tension that makes this interesting — maximum blockchain sophistication with zero blockchain visibility.

---

## Submission Checklist

- [ ] Working MVP (frontend + backend, deployed)
- [ ] Architecture diagram showing: user model, x402 server-side flow, SDK boundary, settlement, withdrawal
- [ ] Demo video (2 min) covering: registration, payment, settlement, withdrawal, Circle product callouts
- [ ] Documentation: README with setup instructions, architecture overview, Circle product usage
- [ ] Circle Product Feedback form (separate, due after deadline)

---

## If We're Running Behind

| Cut | Impact | Notes |
|---|---|---|
| Settlement trigger / "Settle Now" | **Medium** | Payments still work off-chain. Can trigger settlement from terminal for the video. Lose the demo wow-moment. |
| Withdrawal | **Medium** | Can show unified balance without outbound transfers. Mention as "one SDK call" in docs. |
| WebSocket real-time updates | **Low** | Recipient can refresh to see new payments. Less flashy but functional. |
| Transaction history | **Low** | Balance display is enough for demo. |
| "Add Funds" button | **Low** | Pre-fund demo accounts. No need to add more during demo. |
| Netting visualization | **Low** | Just show intent count + tx hash. |

**Absolute minimum viable demo:**
Register two users → one pays the other → balance updates instantly.
That alone tells the story: email signup, tap to pay, instant, no crypto UX.

**Second priority:** Settlement. The "3 intents → 1 tx on Arc" moment.

**Third priority:** Withdrawal. The full cross-chain loop.

---

## Comparison: All Four Plan Versions

| Aspect | v1 (Gateway direct) | v2 (Custom nanopay) | v3 (SDK-first) | v4 (Zero Web3 UX) |
|---|---|---|---|---|
| Sender UX | Connect MetaMask, sign 2-3 txs | Connect MetaMask, sign intent | Connect MetaMask, sign intent | Tap a button. That's it. |
| Recipient UX | Email + password | Email + password | Email + password | Email + password |
| Wallet model | Recipients: dev-controlled. Senders: external. | Same split. | Same split. | Everyone: dev-controlled. Unified. |
| x402 signing | N/A | Custom EIP-712, client-side | SDK EIP-3009, client-side | SDK EIP-3009, **server-side** |
| Web3 libraries in frontend | wagmi, ethers, RainbowKit | wagmi, ethers, RainbowKit | wagmi, viem, RainbowKit | **None** |
| Payment speed | 0.5s–19min (chain finality) | Instant (off-chain) | Instant (off-chain) | Instant (off-chain) |
| Settlement | Immediate per-payment | Custom burn/attest/mint | SDK settle() | SDK settle() |
| Withdrawal | Manual 6-step pipeline | Manual 6-step pipeline | SDK withdraw() | SDK withdraw() |
| Demo risk | Finality wait kills it | Building too much custom | MetaMask setup slows demo | **Near zero** |
| Backend complexity | Simple | Very complex | Moderate | Moderate |
| Frontend complexity | Complex (web3 UX) | Complex (web3 UX) | Complex (web3 UX) | **Simple (just React)** |
| Judge accessibility | Need MetaMask | Need MetaMask | Need MetaMask | **Just need a phone** |