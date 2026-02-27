# USDC.me — Revised Architecture with Nanopayments

## What Changed and Why

Circle's x402 Batching SDK introduces an off-chain spend layer on top of
Gateway. Instead of settling every payment on-chain immediately, payments
are signed as off-chain intents and batched for periodic settlement.

This transforms USDC.me from "cross-chain payment routing" into something
closer to "onchain Venmo" — instant payments with deferred settlement.

```
OLD MODEL                              NEW MODEL
═════════                              ═════════

Every payment hits the chain:          Payments are off-chain signatures:

  pay → deposit → finality →             top up once → deposit → finality
        burn → mint                      pay → sign intent (instant)
                                         pay → sign intent (instant)
  ~15 min per payment                    pay → sign intent (instant)
  Gas on every payment                   settle batch → 1 on-chain tx
                                      
                                         ~0.5s per payment
                                         Gas only on deposit + settle
```


## The Four Phases

The x402 batching model has four phases. Here's how each maps to USDC.me:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   1. DEPOSIT        2. SPEND          3. SETTLE    4. WITHDRAW  │
│   (on-chain)        (off-chain)       (batched)    (on-chain)   │
│                                                                  │
│   Sender loads      Sender signs      Backend      Recipient    │
│   USDC into         EIP-712 spend     batches      triggers     │
│   Gateway from      intents to pay    intents &    settlement   │
│   any chain.        recipients.       settles      & mints      │
│   One-time.         Instant.          hourly.      on any chain.│
│                     Gasless.                                     │
│                                                                  │
│   ┌──────┐         ┌──────┐          ┌──────┐     ┌──────┐     │
│   │ USDC │──►Gate  │ Sign │──►Our    │ Batch│──►  │ Mint │──►  │
│   │ on   │  way    │ only │  Backend │ all  │ Arc │ USDC │ Any │
│   │ Base │  deposit│      │  ledger  │ pend │     │ on   │chain│
│   └──────┘         └──────┘          └──────┘     └──────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: DEPOSIT (On-Chain, One-Time)

The sender needs a Gateway balance before they can spend. They deposit USDC
into the Gateway Wallet contract from whatever chain they're on.

```
Sender (on Base Sepolia)
  │
  │  1. approve(Gateway Wallet, $100)     ← on-chain tx
  │  2. deposit(USDC, $100)               ← on-chain tx
  │
  │  ⏳ Wait for finality (~15 min Base, ~8s Avax, ~0.5s Arc)
  │
  ▼
Gateway API now shows:
  sender_address: 0xSender
  unified_balance: $100.00
  chain_deposits: { base-sepolia: $100 }
```

This is the only time the sender interacts with the blockchain during their
session. After this, everything is off-chain.

For the demo: pre-deposit from Arc Testnet (0.5s finality) before going
on stage. Sender starts with a loaded Gateway balance.


### Phase 2: SPEND (Off-Chain, Instant, Gasless)

When a sender pays @alice, they sign an EIP-712 typed data message — a
"spend intent." This never goes on-chain. It's just a cryptographic
promise: "I authorize $5 from my Gateway balance to go to Alice."

```
SPEND INTENT (EIP-712 Typed Data)
═════════════════════════════════

{
  types: {
    SpendIntent: [
      { name: "sender",    type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount",    type: "uint256" },
      { name: "nonce",     type: "uint256" },
      { name: "deadline",  type: "uint256" },
    ]
  },
  domain: {
    name: "USDC.me",
    version: "1",
    chainId: <gateway-chain-id>,
  },
  message: {
    sender:    "0xSender...",
    recipient: "0xAlice...",      // Alice's Arc wallet
    amount:    5000000,           // $5.00 (6 decimals)
    nonce:     42,                // prevents replay
    deadline:  1709136000,        // expires in 1 hour
  }
}

Sender signs this with their wallet → produces signature (65 bytes)
No on-chain transaction. No gas. Instant.
```

Our backend validates the spend intent:

```
BACKEND VALIDATION
══════════════════

  Receive spend intent + signature from frontend
  │
  ├─ Recover signer from EIP-712 signature
  │   → Must match sender address
  │
  ├─ Check sender's available balance
  │   → Gateway balance minus sum of pending (unsettled) spends
  │   → Must be >= spend amount
  │
  ├─ Check nonce
  │   → Must be sender's next expected nonce
  │   → Prevents replay attacks
  │
  ├─ Check deadline
  │   → Must be in the future
  │
  ├─ If all checks pass:
  │   → Store spend intent in our database
  │   → Credit recipient's off-chain balance
  │   → Debit sender's available balance
  │   → Return success to frontend
  │
  └─ If any check fails:
      → Reject, return error
```

After validation, Alice sees her balance update in real-time. The money
hasn't moved on-chain yet, but the spend intent is a cryptographically
signed commitment backed by the sender's Gateway deposit.


### Phase 3: SETTLE (Batched, Periodic)

Settlement is when off-chain spend intents become on-chain reality. Our
backend collects all pending spends and submits them to Gateway in a
single batch.

```
SETTLEMENT FLOW
═══════════════

Our Backend                         Gateway API              Arc Testnet
    │                                    │                       │
    │  Collect all pending               │                       │
    │  spend intents since               │                       │
    │  last settlement:                  │                       │
    │                                    │                       │
    │  Intent 1: Sender→Alice  $5       │                       │
    │  Intent 2: Sender→Bob    $3       │                       │
    │  Intent 3: Carol→Alice   $12      │                       │
    │  Intent 4: Dave→Bob      $7       │                       │
    │  ─────────────────────────        │                       │
    │  Total: $27                        │                       │
    │                                    │                       │
    │                                    │                       │
    │  STEP 1: Net the transfers         │                       │
    │                                    │                       │
    │  Instead of 4 separate mints,      │                       │
    │  we net by recipient:              │                       │
    │                                    │                       │
    │  Alice: $5 + $12 = $17            │                       │
    │  Bob:   $3 + $7  = $10            │                       │
    │  ────────────────────              │                       │
    │  2 mints instead of 4              │                       │
    │                                    │                       │
    │                                    │                       │
    │  STEP 2: Create burn intents       │                       │
    │  for each sender's portion         │                       │
    │                                    │                       │
    │  Burn intent A: Sender burns $8    │                       │
    │    (from Sender's Gateway balance) │                       │
    │  Burn intent B: Carol burns $12    │                       │
    │    (from Carol's Gateway balance)  │                       │
    │  Burn intent C: Dave burns $7      │                       │
    │    (from Dave's Gateway balance)   │                       │
    │                                    │                       │
    │  Submit to Gateway API             │                       │
    │  POST /transfers (batch)           │                       │
    │──────────────────────────────────►│                       │
    │                                    │                       │
    │  Receive attestations              │                       │
    │◄──────────────────────────────────│                       │
    │                                    │                       │
    │                                    │                       │
    │  STEP 3: Call gatewayMint()        │                       │
    │  on Arc for each recipient         │                       │
    │                                    │                       │
    │  gatewayMint(attestation_A,        │                       │
    │              Alice, $17)           │──────────────────────►│
    │                                    │                       │
    │  gatewayMint(attestation_B,        │                       │
    │              Bob, $10)             │──────────────────────►│
    │                                    │                       │
    │                                    │   $17 minted to Alice │
    │                                    │   $10 minted to Bob   │
    │                                    │                       │
    │  Mark all intents as settled       │                       │
    │                                    │                       │
```

Settlement triggers:
- **Hourly cron job** — settle everything automatically
- **On-demand** — when a recipient requests withdrawal
- **Threshold** — when pending amount exceeds $X


### Phase 4: WITHDRAW (Recipient Gets USDC on Any Chain)

When Alice wants actual USDC in her own wallet on any chain:

```
WITHDRAWAL FLOW
═══════════════

  Alice clicks "Withdraw $50 to Avalanche"
  │
  ├─ 1. Settle any unsettled intents for Alice
  │     (triggers immediate batch settlement for her)
  │
  ├─ 2. Alice now has $50 USDC in her Arc wallet
  │     (minted during settlement)
  │
  ├─ 3. Deposit Alice's $50 into Gateway on Arc
  │     approve() + deposit() on Arc Testnet
  │     (we control her wallet, so our backend signs)
  │     ⏳ 0.5s Arc finality
  │
  ├─ 4. Sign burn intent:
  │     source: Arc
  │     dest: Avalanche Fuji
  │     amount: $50
  │     recipient: Alice's Avalanche address
  │
  ├─ 5. Submit to Gateway API → get attestation
  │     (<500ms)
  │
  └─ 6. Call gatewayMint() on Avalanche Fuji
        $50 USDC minted to Alice's external wallet

  Total time: ~2-3 seconds (Arc finality + Gateway)
```


## Revised System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USDC.me SYSTEM (v2)                            │
│                                                                          │
│  ┌──────────────┐    ┌──────────────────────────┐    ┌───────────────┐  │
│  │              │    │                           │    │               │  │
│  │   Frontend   │    │   Backend (Facilitator)   │    │   Onchain     │  │
│  │              │    │                           │    │               │  │
│  │  • Pay page  │    │  ┌─────────────────────┐  │    │  Gateway      │  │
│  │  • QR codes  │    │  │  Off-Chain Ledger    │  │    │  Contracts    │  │
│  │  • Dashboard │    │  │                     │  │    │  (deposit,    │  │
│  │  • Wallet    │◄──►│  │  sender balances    │  │◄──►│   mint)       │  │
│  │    connect   │    │  │  recipient credits  │  │    │               │  │
│  │  • EIP-712   │    │  │  pending intents    │  │    │  USDC Token   │  │
│  │    signing   │    │  │  settled intents    │  │    │  Contracts    │  │
│  │              │    │  └─────────────────────┘  │    │               │  │
│  │              │    │                           │    │  Circle       │  │
│  │              │    │  ┌─────────────────────┐  │    │  Wallets      │  │
│  │              │    │  │  Settlement Engine   │  │    │  (Arc)        │  │
│  │              │    │  │                     │  │    │               │  │
│  │              │    │  │  • Hourly cron      │  │    │               │  │
│  │              │    │  │  • On-demand        │  │    │               │  │
│  │              │    │  │  • Net by recipient │  │    │               │  │
│  │              │    │  │  • Batch burn+mint  │  │    │               │  │
│  │              │    │  └─────────────────────┘  │    │               │  │
│  │              │    │                           │    │               │  │
│  └──────────────┘    └──────────────────────────┘    └───────────────┘  │
│                                                                          │
│         Off-chain                  Off-chain              On-chain       │
│         (browser)                  (our server)           (blockchain)   │
└─────────────────────────────────────────────────────────────────────────┘
```


## Revised User Flows

### Flow 1: Registration (unchanged)

Same as before. Create Circle Wallet on Arc, store handle mapping.


### Flow 2: Sender Top-Up (New — replaces per-payment deposit)

Before a sender can pay anyone, they need Gateway balance. This is like
loading a prepaid account.

```
 Sender                  Frontend               Backend              Onchain
  │                         │                       │                   │
  │  Opens usdc.me/@alice   │                       │                   │
  │  Enters $50             │                       │                   │
  │  Connects wallet (Base) │                       │                   │
  │────────────────────────►│                       │                   │
  │                         │                       │                   │
  │                         │  Check: does sender   │                   │
  │                         │  have Gateway balance? │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  "No balance. Sender  │                   │
  │                         │   needs to deposit."  │                   │
  │                         │◄──────────────────────│                   │
  │                         │                       │                   │
  │  "Top up your USDC.me   │                       │                   │
  │   balance to pay        │                       │                   │
  │   instantly. Deposit     │                       │                   │
  │   $50+ USDC from Base." │                       │                   │
  │◄────────────────────────│                       │                   │
  │                         │                       │                   │
  │  Signs approve + deposit│                       │                   │
  │  on Base Sepolia        │                       │                   │
  │─────────────────────────┼───────────────────────┼──────────────────►│
  │                         │                       │                   │
  │                         │                       │  ⏳ Finality wait │
  │                         │                       │  (chain-dependent)│
  │                         │                       │                   │
  │                         │  Gateway API confirms │                   │
  │                         │  balance: $50         │                   │
  │                         │◄──────────────────────│                   │
  │                         │                       │                   │
  │  "Balance loaded!       │                       │                   │
  │   You can now pay       │                       │                   │
  │   anyone instantly."    │                       │                   │
  │◄────────────────────────│                       │                   │
```

The UX decision: do we make the sender top up BEFORE paying, or inline
during the first payment? For the hackathon, inline is better — show the
deposit step as part of the payment flow if they have no balance.

For repeat senders, they already have balance and skip straight to spend.


### Flow 3: Instant Payment (The New Core Flow)

Sender has Gateway balance. Pays @alice. No blockchain interaction.

```
 Sender                  Frontend               Backend
  │                         │                       │
  │  Opens usdc.me/@alice   │                       │
  │  Enters $5              │                       │
  │────────────────────────►│                       │
  │                         │                       │
  │                         │  GET /user/alice      │
  │                         │──────────────────────►│
  │                         │  {wallet_address,     │
  │                         │   handle: "alice"}    │
  │                         │◄──────────────────────│
  │                         │                       │
  │                         │  Check sender's       │
  │                         │  available balance    │
  │                         │──────────────────────►│
  │                         │  {available: $47.00}  │
  │                         │◄──────────────────────│
  │                         │                       │
  │                         │                       │
  │  Frontend constructs    │                       │
  │  EIP-712 spend intent:  │                       │
  │                         │                       │
  │  {                      │                       │
  │    sender: 0xSender     │                       │
  │    recipient: 0xAlice   │                       │
  │    amount: 5000000      │                       │
  │    nonce: 7             │                       │
  │    deadline: +1hr       │                       │
  │  }                      │                       │
  │                         │                       │
  │  Wallet popup:          │                       │
  │  "Sign message"         │                       │
  │  (NOT a transaction)    │                       │
  │                         │                       │
  │  ✍️  Signs              │                       │
  │  (instant, free)        │                       │
  │─────────────────────────┤                       │
  │                         │                       │
  │                         │  POST /pay/alice      │
  │                         │  {intent, signature}  │
  │                         │──────────────────────►│
  │                         │                       │
  │                         │  Backend validates:   │
  │                         │  ✓ Signature valid    │
  │                         │  ✓ Balance sufficient │
  │                         │  ✓ Nonce correct      │
  │                         │  ✓ Not expired        │
  │                         │                       │
  │                         │  Update ledger:       │
  │                         │  Sender: $47→$42      │
  │                         │  Alice:  $17→$22      │
  │                         │                       │
  │                         │  Store intent in DB   │
  │                         │  (pending settlement) │
  │                         │                       │
  │                         │  {status: "success",  │
  │                         │   new_balance: $42}   │
  │                         │◄──────────────────────│
  │                         │                       │
  │  "Paid @alice $5! ✅"   │                       │
  │  Took: ~0.5 seconds     │                       │
  │◄────────────────────────│                       │
  │                         │                       │
  │                         │  (Meanwhile, Alice's  │
  │                         │   dashboard updates   │
  │                         │   via WebSocket)      │
```

**This is the demo moment.** Scan QR → sign one message → done.
Sub-second. No gas. No chain selection. No finality wait.


### Flow 4: Batch Settlement (Backend Cron)

Runs hourly (or on-demand). Nobody sees this — it's backend housekeeping.

```
 Settlement Engine            Gateway API              Arc Testnet
  │                               │                        │
  │  [CRON: every hour]           │                        │
  │                               │                        │
  │  Query DB for all intents     │                        │
  │  with status = "pending"      │                        │
  │                               │                        │
  │  Found 47 intents:            │                        │
  │  ├─ 12 senders               │                        │
  │  ├─ 8 recipients              │                        │
  │  └─ Total: $423.50           │                        │
  │                               │                        │
  │                               │                        │
  │  NET BY RECIPIENT:            │                        │
  │  ┌───────────────────────┐   │                        │
  │  │ @alice:   $87.00      │   │                        │
  │  │ @bob:     $142.50     │   │                        │
  │  │ @carol:   $53.00      │   │                        │
  │  │ @dave:    $95.00      │   │                        │
  │  │ @eve:     $46.00      │   │                        │
  │  │ ───────────────────── │   │                        │
  │  │ Total:    $423.50     │   │                        │
  │  └───────────────────────┘   │                        │
  │                               │                        │
  │  47 intents → 5 mints        │                        │
  │  (massive gas savings)        │                        │
  │                               │                        │
  │                               │                        │
  │  GROUP BY SENDER, create      │                        │
  │  burn intents for each:       │                        │
  │                               │                        │
  │  POST /transfers (batch)      │                        │
  │  [burn intent 1: sender A]    │                        │
  │  [burn intent 2: sender B]    │                        │
  │  [...]                        │                        │
  │──────────────────────────────►│                        │
  │                               │                        │
  │  Attestations returned        │                        │
  │◄──────────────────────────────│                        │
  │                               │                        │
  │  Call gatewayMint() × 5       │                        │
  │  (one per recipient)          │                        │
  │───────────────────────────────┼───────────────────────►│
  │                               │                        │
  │                               │  $87.00 → @alice       │
  │                               │  $142.50 → @bob        │
  │                               │  $53.00 → @carol       │
  │                               │  $95.00 → @dave        │
  │                               │  $46.00 → @eve         │
  │                               │                        │
  │  Mark all 47 intents          │                        │
  │  as "settled"                 │                        │
  │                               │                        │
  │  Update DB balances           │                        │
  │  (on-chain now matches        │                        │
  │   off-chain ledger)           │                        │
```


### Flow 5: Withdrawal (On-Demand Settlement + Cross-Chain Mint)

When Alice wants USDC on a specific chain:

```
 Alice                   Frontend               Backend             Onchain
  │                         │                       │                   │
  │  "Withdraw $50 to       │                       │                   │
  │   my Avalanche wallet"  │                       │                   │
  │────────────────────────►│                       │                   │
  │                         │  POST /withdraw       │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  1. Settle Alice's    │                   │
  │                         │     pending intents   │                   │
  │                         │     (if any unsettled)│                   │
  │                         │                       │                   │
  │                         │     [settlement runs  │                   │
  │                         │      for Alice only]  │                   │
  │                         │                       │──────────────────►│
  │                         │                       │  gatewayMint()    │
  │                         │                       │  on Arc for Alice │
  │                         │                       │                   │
  │                         │  2. Now Alice has     │                   │
  │                         │     USDC on Arc.      │                   │
  │                         │     Move to Avalanche:│                   │
  │                         │                       │                   │
  │                         │     a) deposit to     │                   │
  │                         │        Gateway on Arc │──────────────────►│
  │                         │        (0.5s finality)│                   │
  │                         │                       │                   │
  │                         │     b) sign burn      │                   │
  │                         │        intent →       │                   │
  │                         │        Avalanche      │                   │
  │                         │                       │                   │
  │                         │     c) submit to      │                   │
  │                         │        Gateway API    │                   │
  │                         │                       │                   │
  │                         │     d) gatewayMint()  │                   │
  │                         │        on Avalanche   │──────────────────►│
  │                         │                       │                   │
  │                         │                       │  $50 USDC minted  │
  │                         │                       │  to Alice's Avax  │
  │                         │                       │  address          │
  │                         │                       │                   │
  │  "Withdrew $50 to       │  {tx_hash, status}    │                   │
  │   Avalanche! ✅"        │◄──────────────────────│                   │
  │◄────────────────────────│                       │                   │
```


## Revised Data Model

```
DATABASE SCHEMA (v2 — with off-chain ledger)
════════════════════════════════════════════

users
├── id                (UUID)
├── handle            (VARCHAR, unique)
├── wallet_id         (VARCHAR, Circle wallet ID)
├── wallet_address    (VARCHAR, 0x on Arc)
├── created_at        (TIMESTAMP)
└── updated_at        (TIMESTAMP)


gateway_deposits
├── id                (UUID)
├── depositor_address (VARCHAR, sender's address)
├── amount            (DECIMAL, USDC deposited)
├── source_chain      (VARCHAR, e.g. "base-sepolia")
├── tx_hash           (VARCHAR, deposit tx hash)
├── status            (ENUM: pending_finality, confirmed)
├── confirmed_at      (TIMESTAMP)
└── created_at        (TIMESTAMP)


spend_intents
├── id                (UUID)
├── sender_address    (VARCHAR, who signed)
├── recipient_handle  (VARCHAR, e.g. "alice")
├── recipient_address (VARCHAR, 0x on Arc)
├── amount            (DECIMAL, USDC amount)
├── nonce             (INTEGER, per-sender incrementing)
├── deadline          (TIMESTAMP, expiry)
├── signature         (VARCHAR, EIP-712 sig, 65 bytes hex)
├── intent_hash       (VARCHAR, hash of the typed data)
├── status            (ENUM: pending, settling, settled, expired)
├── settlement_id     (UUID, FK → settlements, null until settled)
├── created_at        (TIMESTAMP)
└── settled_at        (TIMESTAMP)


settlements
├── id                (UUID)
├── total_amount      (DECIMAL, sum of all intents in batch)
├── num_intents       (INTEGER, how many intents in this batch)
├── num_recipients    (INTEGER, how many unique recipients)
├── trigger           (ENUM: cron, withdrawal, manual)
├── status            (ENUM: processing, completed, failed)
├── created_at        (TIMESTAMP)
└── completed_at      (TIMESTAMP)


settlement_mints
├── id                (UUID)
├── settlement_id     (UUID, FK → settlements)
├── recipient_handle  (VARCHAR)
├── recipient_address (VARCHAR)
├── amount            (DECIMAL, netted amount for this recipient)
├── destination_chain (VARCHAR, usually "arc-testnet")
├── mint_tx_hash      (VARCHAR, gatewayMint tx hash)
├── status            (ENUM: pending, confirmed, failed)
└── created_at        (TIMESTAMP)


balances (materialized view / cached)
├── address           (VARCHAR, primary key)
├── handle            (VARCHAR, null for non-registered senders)
├── gateway_balance   (DECIMAL, confirmed Gateway deposits)
├── pending_spend     (DECIMAL, sum of unsettled spend intents)
├── available         (DECIMAL, gateway_balance - pending_spend)
├── received_pending  (DECIMAL, credited but unsettled)
├── received_settled  (DECIMAL, settled and on-chain)
└── updated_at        (TIMESTAMP)
```


## Revised API Endpoints

```
PUBLIC ENDPOINTS
════════════════

POST   /api/register
       Body: { handle }
       → { handle, qr_code, pay_link }

GET    /api/user/:handle
       → { handle, wallet_address }
       (Used by payment page)

GET    /api/balance/:address
       → { gateway_balance, pending_spend, available }
       (Sender checks their available balance before paying)


PAYMENT ENDPOINTS
═════════════════

POST   /api/pay/:handle
       Body: { intent, signature }
       intent: { sender, recipient, amount, nonce, deadline }
       → Validates signature, checks balance, stores intent
       → { status: "success", new_available_balance }

GET    /api/nonce/:address
       → { next_nonce }
       (Frontend needs this to construct the intent)


AUTHENTICATED ENDPOINTS (recipient)
════════════════════════════════════

GET    /api/dashboard/:handle
       → { received_pending, received_settled, total_balance,
           recent_payments: [...] }

POST   /api/withdraw
       Body: { amount, destination_chain, destination_address }
       → Triggers settlement + cross-chain mint
       → { status, estimated_time, settlement_id }

GET    /api/transactions/:handle
       → [ { from, amount, timestamp, status } ]


DEPOSIT ENDPOINT (for senders)
══════════════════════════════

POST   /api/deposit/prepare
       Body: { sender_address, amount, source_chain }
       → { gateway_wallet_address, usdc_contract_address,
           deposit_instructions }
       (Frontend uses this to guide sender through deposit)

POST   /api/deposit/confirm
       Body: { sender_address, tx_hash, source_chain }
       → Begins monitoring for finality confirmation
       → { status: "monitoring" }


INTERNAL / ADMIN
════════════════

POST   /api/settle
       → Manually trigger settlement batch
       → { settlement_id, num_intents, num_recipients }

GET    /api/settlement/:id
       → { status, intents_count, mints: [...] }
```


## The Fee Model (Revised)

With nanopayments, fees become cleaner:

```
FEE EXTRACTION
══════════════

When sender signs a spend intent for $50:

  Our backend stores:
    recipient credit:  $49.75  (99.5%)
    platform fee:      $0.25   (0.5%)

  At settlement time:
    gatewayMint() to Alice:    $49.75
    gatewayMint() to fee wallet: $0.25
    (or just accumulate fees and settle less frequently)

  Even simpler: during settlement netting, just subtract
  our fee from each recipient's netted total.

  47 intents → 5 recipient mints + 1 fee mint = 6 mints total
```


## Demo Script (Revised — Much Better Now)

```
DEMO: 2 MINUTES
════════════════

Setup (done before demo):
• Pre-register @demo account
• Pre-deposit $100 USDC from Arc Testnet into Gateway
  for the "sender" wallet (0.5s, done backstage)

0:00  "This is USDC.me. One handle. Any chain."
      Show the @demo payment page + QR code.

0:15  "Let me pay myself from a different wallet."
      Open phone, scan QR code.
      Payment page loads. Enter $5.

0:25  "I already have USDC loaded in Gateway.
       Watch — one signature, no gas, instant."

0:30  Sign the EIP-712 message on phone.
      ✅ "Paid @demo $5!"
      
      Dashboard on laptop updates in real-time.
      "$5 received from 0xAbc..."

0:40  "That payment never hit the blockchain.
       It's an off-chain signed intent.
       Instant. Gasless. Cryptographically binding."

0:55  "I can stack up payments all day.
       They batch-settle hourly on Arc."
      
      Click "Settle Now" button on admin panel.
      Show settlement happening — 1 on-chain tx
      for all pending payments.

1:15  "Now let's say I want my money on Avalanche."
      Click Withdraw → $20 → Avalanche.
      
      "Settlement triggers, Gateway mints on Avalanche.
       Sub-second on Arc, then instant cross-chain."

1:35  Show the Avalanche Fuji block explorer.
      $20 USDC minted to withdrawal address.

1:45  "To recap: the sender deposited once.
       Every payment after that was a signature.
       Settlement batches everything.
       Withdrawal goes to any of 9 chains.
       
       One handle. Instant payments. Zero gas.
       That's USDC.me."

2:00  End.
```


## Why This Architecture Wins

```
JUDGES CARE ABOUT                  HOW WE DELIVER
══════════════════                 ════════════════

Arc as liquidity hub?              Arc is where all settlements
                                   land. Hub by design.

Uses Gateway?                      Gateway for deposits, settlement,
                                   AND cross-chain withdrawals.
                                   Triple integration.

Chain abstraction?                 Sender deposits from any chain.
                                   Recipient withdraws to any chain.
                                   Payments are chain-agnostic.

Innovation?                        Nanopayments/batching is Circle's
                                   newest product. We're early
                                   adopters showing the pattern.

Real product?                      Venmo-like UX. QR codes.
                                   Instant payments. This could
                                   actually be used.

Technical depth?                   Off-chain ledger, EIP-712 signing,
                                   netting algorithm, batch settlement,
                                   cross-chain withdrawal pipeline.
```