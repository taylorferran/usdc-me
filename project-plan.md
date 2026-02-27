# USDC.me — Project Plan (v2: Nanopayments)

**Hackathon:** Encode × Arc Enterprise & DeFi Hackathon
**Bounty:** Best Chain Abstracted USDC Apps Using Arc as a Liquidity Hub
**Prize pool:** $10,000
**Note:** Arc is currently testnet-only, so we're building the entire project on testnets. Demo will use testnet USDC (free from Circle's faucet — no real money needed).

---

## What We're Building

A universal payment handle for USDC — like Venmo usernames but for crypto. You register a handle (e.g. `@alice`), get a QR code and a payment link, and anyone can pay you instantly. No blockchain interaction at payment time. No gas. Sub-second.

Under the hood, we use Circle's x402 Batching SDK to keep payments off-chain as signed intents, then batch-settle them on Arc via Gateway. Senders deposit USDC once (from any chain) and then every payment is just a signature.

**One handle. One QR code. Every chain. Truly instant.**

---

## Why It Wins

- Judges can try it themselves at the demo (scan a QR, sign one message, see payment land instantly)
- Uses every required tool: Arc, USDC, Circle Wallets, Circle Gateway — plus the x402 Batching SDK (Circle's newest product, early access)
- It's a real product people would actually use, not a hackathon toy
- Chain abstraction is invisible — which is the whole point
- Payments are genuinely instant and gasless — not "fast after 8 seconds of finality," but actually instant because they're off-chain
- Batch settlement on Arc demonstrates Arc-as-hub in the most compelling way: all payments funnel to Arc

---

## How It Works (Simple Version)

### The Four Phases

1. **DEPOSIT (one-time)** — Sender loads USDC into Circle Gateway from whatever chain they're on. This is like topping up a prepaid balance. It only happens once.
2. **SPEND (instant, every payment)** — Sender signs an off-chain EIP-712 message saying "pay @alice $5." No blockchain transaction. No gas. Our backend validates the signature and credits Alice's balance immediately.
3. **SETTLE (batched, periodic)** — Our backend collects all pending payment intents and settles them on-chain in a single batch via Gateway. This happens hourly, or when a user requests a withdrawal. 47 individual payments might collapse into 5 on-chain mints (one per recipient).
4. **WITHDRAW (on-demand)** — Alice wants her USDC on Avalanche? She triggers settlement of her pending balance, Gateway mints on her chosen chain. Takes ~2 seconds from Arc.

### Why This Is Different

In the old model, every payment required on-chain deposit → finality wait → burn → mint. A payment from Base Sepolia took 15+ minutes.

Now, the finality wait happens once (at deposit time). After that, every payment is a sub-second signature. The demo goes from "watch this payment land in 15 minutes" to "watch this payment land before I finish this sentence."

---

## Features (Priority Order)

### Must Have (Saturday)

1. **Handle registration** — sign up, pick a username, wallet gets created on Arc Testnet via Circle Wallets API
2. **Payment page** — `usdc.me/@alice` shows a simple pay screen with amount input
3. **Sender deposit flow** — sender connects wallet, deposits USDC into Gateway from any testnet chain (one-time top-up)
4. **Off-chain payment** — sender signs EIP-712 spend intent, backend validates and credits recipient instantly
5. **QR code** — auto-generated for each handle, links to the payment page
6. **Balance display** — show available balance (Gateway deposits minus pending spends) and received balance (credited from incoming payments)

### Should Have (Sunday Morning)

7. **Batch settlement engine** — cron job + manual trigger to settle all pending intents via Gateway burn+mint on Arc
8. **Transaction history** — list of incoming payments with sender, amount, timestamp, settlement status
9. **Withdraw to any chain** — triggers settlement for that user, then Gateway mint on destination chain
10. **"Settle Now" admin button** — for the demo, lets us trigger batch settlement on command and show the netting

### Nice to Have (Sunday Afternoon, If Time)

11. **Fiat on-ramp** — let non-crypto payers buy USDC with a card via Circle Gateway and deposit directly
12. **Mini treasury** — option to park idle settled balance in USYC (yield-bearing asset) to earn interest
13. **Real-time notifications** — payment received alerts via WebSocket
14. **Public profile customisation** — name, avatar, bio on payment page

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React + TypeScript | Payment page, dashboard, wallet connect |
| Backend | Node.js + Express | Off-chain ledger, settlement engine, Gateway/Wallet API calls |
| Database | SQLite | Users, gateway deposits, spend intents, settlements, balances |
| Wallets | Circle Wallets (developer-controlled) | Each recipient gets a wallet on Arc Testnet |
| Cross-chain deposits | Circle Gateway API (testnet) | Sender deposits from any chain into unified balance |
| Off-chain payments | x402 Batching SDK + EIP-712 | Signed spend intents, validated by backend, no on-chain tx |
| Batch settlement | Circle Gateway API (testnet) | Backend nets intents by recipient, batch burn+mint on Arc |
| Cross-chain withdrawals | Circle Gateway API (testnet) | Settle to Arc, then Gateway mint on any destination chain |
| QR codes | `qrcode` npm package | Generate from payment link |
| Deploy | Vercel (frontend) + Railway (backend) | Free tier, fast deploys |

---

## Circle Products We're Using

| Product | What For |
|---|---|
| **Arc (Testnet)** | Hub chain where all settlements land — fastest finality (0.5s), gas paid in USDC natively |
| **USDC (Testnet)** | The only currency in the app (free from faucet.circle.com) |
| **Circle Wallets** | Create and manage a wallet for each registered recipient |
| **Circle Gateway (Testnet)** | Sender deposits, batch settlement, cross-chain withdrawals |
| **x402 Batching SDK** | Off-chain spend intents, gasless payment signing, batched settlement pattern |

---

## Architecture Overview (For the Team)

### The Off-Chain Ledger

This is the core of the new architecture. Our backend maintains a ledger that tracks:

- **Sender balances** — how much each sender has deposited into Gateway minus how much they've committed in pending (unsettled) spend intents
- **Recipient credits** — how much each recipient has been credited from incoming spend intents, split into "pending" (not yet settled on-chain) and "settled" (minted on Arc)
- **Spend intents** — the signed EIP-712 messages, stored with their status (pending → settling → settled)

The ledger is the source of truth for instant balance updates. On-chain state catches up at settlement time.

### How a Payment Actually Works

When a sender pays @alice $5:

1. Frontend constructs an EIP-712 typed data message: `{sender, recipient, amount, nonce, deadline}`
2. Sender's wallet signs this message (one-click, no gas, no blockchain interaction)
3. Frontend sends the intent + signature to our backend
4. Backend validates: recovers signer from signature, checks available balance (Gateway deposits minus pending spends), verifies nonce (prevents replay), checks deadline hasn't passed
5. If valid: store intent in DB, credit Alice's pending balance, debit sender's available balance
6. Alice's dashboard updates via WebSocket — she sees "$5 from 0xAbc..." immediately
7. The actual USDC hasn't moved on-chain yet — that happens at settlement

### How Settlement Works

Our backend runs a settlement engine (hourly cron + on-demand trigger):

1. Query all spend intents with status = "pending"
2. Net by recipient: if Alice received $5, $3, and $12 from three different senders, she gets one $20 mint (not three separate mints)
3. Group by sender: create Gateway burn intents for each sender's total outflows
4. Submit batch to Gateway API → receive attestations
5. Call `gatewayMint()` on Arc Testnet for each recipient's netted total
6. Mark all intents as "settled," update balances

The netting is where the magic is — 47 individual payments might become 5 on-chain mints. Massive gas savings, and it demonstrates why batching matters.

### How Withdrawal Works

When Alice wants USDC on Avalanche:

1. Settle any unsettled intents for Alice (immediate partial settlement)
2. Alice now has USDC on Arc (in her Circle Wallet)
3. Deposit that USDC into Gateway on Arc (0.5s finality)
4. Sign burn intent targeting Avalanche Fuji
5. Submit to Gateway API → attestation → `gatewayMint()` on Avalanche
6. USDC appears in Alice's Avalanche wallet in ~2 seconds total

---

## Gateway Basics (For the Team)

Gateway is Circle's tool for moving USDC between chains. Three key operations:

1. **Deposit** — User sends USDC to a Gateway Wallet contract on their chain. Once confirmed (after finality), it adds to their unified balance.
2. **Check balance** — API call returns total balance across all chains as one number.
3. **Transfer (mint)** — User signs a "burn intent," submits to Gateway API, gets an attestation, calls `gatewayMint()` on the destination chain. USDC appears there in <500ms.

**We're using the testnet Gateway API:** `https://gateway-api-testnet.circle.com/v1`

**Deposit confirmation time varies by chain.** Arc Testnet = 0.5 seconds. Avalanche Fuji = ~8 seconds. Ethereum Sepolia = 13-19 minutes. This is why Arc is our hub — deposits and settlements are near-instant.

**Supported chains (testnet):** Arc Testnet, Avalanche Fuji, Base Sepolia, Ethereum Sepolia, HyperEVM Testnet, Sei Atlantic, Solana Devnet, Sonic Testnet, World Chain Sepolia (9 chains).

**Getting testnet tokens:**
- Testnet USDC: https://faucet.circle.com/ (free, just enter your wallet address)
- Testnet native tokens (for gas on deposit step): use each chain's faucet

**Docs:**
- Gateway quickstart: https://developers.circle.com/gateway/quickstarts/unified-balance-evm
- Gateway overview: https://developers.circle.com/gateway
- Circle Wallets: https://developers.circle.com/wallets
- Circle Paymaster: https://developers.circle.com/paymaster
- Full docs index: https://developers.circle.com/llms.txt

---

## x402 Batching SDK (For the Team)

This is Circle's new SDK (early access, private beta) that enables off-chain spend intents settled via Gateway. It's the key tool that makes our instant payment flow possible.

### Core Concepts

- **Deposit:** Sender moves USDC into Gateway (on-chain, one-time). This establishes their spendable balance.
- **Spend:** Sender signs an EIP-712 intent to pay a recipient. Off-chain, gasless, instant. Our backend (the "facilitator") validates and stores these.
- **Settle:** Our backend batches pending intents and settles them on-chain via Gateway burn+mint. Happens periodically or on-demand.
- **Withdraw:** Recipient triggers settlement and Gateway mints USDC on their chosen destination chain.

### What We Use From the SDK

- The EIP-712 typed data schema for spend intents
- Signature validation utilities
- Gateway integration helpers for batch settlement
- The facilitator pattern (our backend plays this role)

### Setup

```bash
# Private registry access (token provided by Circle)
export CLOUDSMITH_TOKEN=your_token_here

# .npmrc in project root
@circlefin:registry=https://npm.cloudsmith.io/circle/common-private/
//npm.cloudsmith.io/circle/common-private/:_authToken=${CLOUDSMITH_TOKEN}

# Install
npm install @circlefin/x402-batching @x402/core viem
```

---

## Gasless Payments (For the Team)

With the nanopayments architecture, gas is much less of an issue than before, because the only on-chain interaction for senders is the initial deposit. But we still want that deposit to be as smooth as possible.

### On Arc (Automatic)

Arc natively uses USDC as gas. No separate gas token needed. If a sender deposits from Arc, they pay a tiny fee in USDC (~$0.009). This is already gasless in the way users care about — no need to acquire a separate token.

### On Other EVM Chains (For the Deposit Step)

When a sender deposits from Base Sepolia or Ethereum Sepolia, they do need gas for the `approve()` + `deposit()` transactions on that chain. Two options:

1. **Circle Paymaster** (preferred) — sponsor gas for the deposit transactions so the sender only needs USDC
2. **Accept it** (pragmatic) — since the deposit only happens once, we can accept that senders need a tiny amount of native gas for that one-time step. The testnet faucets provide this for free.

**For the hackathon:** Focus on the story that every payment after the deposit is gasless. The deposit itself is a one-time cost, like loading a gift card. If we have time, add Paymaster for the deposit step too.

### Why Gas Matters Less Now

Before nanopayments: every payment = on-chain transaction = gas needed every time.
After nanopayments: only the deposit is on-chain. Every payment is off-chain. Gas goes from "needed every time you pay" to "needed once when you top up."

This is the key UX improvement. Tell this story to the judges.

---

## Weekend Schedule

### Saturday

| Time | Task | Who |
|---|---|---|
| **Morning (4 hrs)** | Project setup, Circle Wallets integration, database schema (users, deposits, intents, settlements), handle registration API | Backend |
| **Morning (4 hrs)** | Payment page UI, registration flow, QR generation, wallet connect | Frontend |
| **Afternoon (4 hrs)** | Gateway deposit flow (sender top-up), EIP-712 spend intent validation, off-chain ledger logic (credit/debit balances) | Backend |
| **Afternoon (4 hrs)** | Payment flow UI (deposit prompt if needed → spend intent signing), balance dashboard | Frontend |
| **Evening (2 hrs)** | End-to-end test: register → deposit from Arc → sign spend intent → see balance update instantly | Everyone |

### Sunday

| Time | Task | Who |
|---|---|---|
| **Morning (4 hrs)** | Settlement engine (batch burn+mint via Gateway), withdraw flow, "Settle Now" trigger | Backend |
| **Morning (4 hrs)** | Transaction history, settlement status indicators, withdraw UI, polish, mobile responsive | Frontend |
| **Afternoon (2 hrs)** | Architecture diagram, documentation, Circle Product Feedback draft | Everyone |
| **Afternoon (2 hrs)** | Record demo video, practice live demo, pre-fund demo wallets | Everyone |

### Key Change From v1 Plan

Saturday's core goal shifts from "get a cross-chain payment working end-to-end" to "get the off-chain spend intent flow working end-to-end." The cross-chain part (deposit + settlement) is now split across Saturday afternoon (deposit) and Sunday morning (settlement). This is intentional — the instant payment moment is the priority for the demo, and settlement is backend housekeeping that can be less polished.

---

## Demo Script (2 Minutes)

**Setup (done before the demo):**
- Pre-register @demo account
- Pre-deposit $100 USDC from Arc Testnet into Gateway for the sender wallet (0.5s, done backstage)
- This means the sender already has a loaded Gateway balance when we go on stage

**The demo:**

1. **(0:00)** Open USDC.me. Show the @demo payment page and QR code.
   *"This is USDC.me. Register a handle, get a QR code, accept USDC from anyone."*

2. **(0:15)** From a second device (phone), scan the QR code. Payment page loads. Enter $5.
   *"I'm paying from a different wallet. I already have USDC loaded — like a prepaid balance."*

3. **(0:25)** Sign the EIP-712 message on the phone. One signature. Done.
   ✅ Dashboard on laptop updates in real-time. "$5 received."
   *"That took half a second. No gas. No blockchain transaction. It's an off-chain signed intent — cryptographically binding, but instant."*

4. **(0:45)** Do two more quick payments ($3, $8) in rapid succession.
   ✅ Balance ticks up each time.
   *"I can stack payments all day. Every one is just a signature."*

5. **(1:00)** Switch to admin/dashboard view. Show pending intents.
   *"These are all off-chain right now. They batch-settle on Arc."*
   Click "Settle Now."
   Show: 3 intents → 1 on-chain mint. Transaction hash appears.
   *"Three payments, one on-chain transaction. That's the netting."*

6. **(1:20)** Click Withdraw → $10 → Avalanche Fuji.
   Settlement triggers. Gateway mints on Avalanche.
   *"My money started on Arc, now it's on Avalanche. Any of 9 chains."*

7. **(1:40)** Wrap up.
   *"Sender deposited USDC once. Every payment after that was a signature — instant, gasless. Settlement batches everything on Arc. Withdrawal goes to any chain.*
   
   *One handle. Instant payments. Zero gas. That's USDC.me."*

8. **(2:00)** End.

### Why This Demo Is Better Than v1

- **Speed is undeniable.** Payments land before the audience finishes reading the QR code.
- **Multiple payments in rapid succession** shows the power of off-chain intents. v1 couldn't do this — each payment needed finality.
- **The "Settle Now" moment** is visually compelling. Judges see 3 intents collapse into 1 on-chain transaction. This demonstrates batch efficiency and Arc-as-hub.
- **No awkward finality wait.** v1 required either a pre-recorded video or paying from Arc-only to avoid the 15-minute Ethereum wait. Now it doesn't matter — the payment is instant regardless.

---

## Submission Checklist

- [ ] Working MVP with frontend and backend
- [ ] Architecture diagram (showing deposit → off-chain ledger → batch settlement → withdrawal)
- [ ] Demo video covering core functions and Circle tool usage
- [ ] Documentation
- [ ] Circle Product Feedback form (separate, due after deadline)

---

## If We're Running Behind

| Cut this | Impact | Notes |
|---|---|---|
| Batch settlement engine | **High — but recoverable** | Without settlement, payments stay off-chain only. Still demoable if we frame it as "settlement runs hourly in production, here's the ledger." Can settle manually via API calls. |
| Withdraw to other chains | Medium | We can show unified balance without outbound transfers. Settlement to Arc still proves the point. |
| Gasless deposits (Paymaster) | Low | Sender needs gas for one-time deposit. Fine on testnet — faucets exist. |
| Fiat on-ramp | Low | Nice feature but not core |
| Transaction history | Low | Balance display is enough for demo |
| USYC treasury | Low | Bonus feature |
| "Settle Now" UI button | Low | Can trigger settlement from terminal if needed |

**Absolute minimum viable demo:** Register a handle → get a QR code → sender has Gateway balance → sign one spend intent → balance updates instantly. That alone tells the full story: off-chain payments, chain-abstracted, gasless.

**Second priority:** Add batch settlement so we can show the "3 intents → 1 mint" netting moment on Arc. This is what makes it Arc-as-hub.

**Third priority:** Add withdrawal to demonstrate the full loop — deposit from any chain, pay instantly, settle on Arc, withdraw to any chain.

---

## Key Differences From v1 Plan

| Aspect | v1 (Per-Payment On-Chain) | v2 (Nanopayments) |
|---|---|---|
| Payment speed | Depends on source chain finality (0.5s–19min) | Always instant (off-chain signature) |
| Gas per payment | Required on source chain | Zero (only on deposit, once) |
| On-chain transactions per payment | 2-3 (approve, deposit, mint) | 0 (settled in batch later) |
| Demo reliability | Risky — finality waits could embarrass us | Bulletproof — signatures are instant |
| Settlement | Immediate per-payment | Batched hourly or on-demand |
| Backend complexity | Simple (relay to Gateway) | More complex (off-chain ledger, nonce tracking, EIP-712 validation, settlement engine) |
| Circle product depth | Gateway + Wallets | Gateway + Wallets + x402 Batching SDK |
| "Wow" moment | Cross-chain payment lands | Rapid-fire payments + batch settlement netting |

The tradeoff is clear: more backend complexity in exchange for a radically better demo and a more impressive technical story. For a hackathon where the demo is everything, this is the right call.