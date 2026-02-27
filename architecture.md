# USDC.me — Architecture & User Flows (v4: Zero Web3 UX)

## What Changed and Why

### The Original Problem

Circle's x402 Batching SDK enables off-chain spend intents with batch
settlement on Arc via Gateway. Instead of every payment requiring an
on-chain transaction, payments are signed intents that settle periodically.

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

### The v4 Insight: Who Signs?

Previous versions assumed senders would connect an external wallet
(MetaMask etc.) and sign spend intents in the browser. This created
a split UX: recipients had a Web2 experience (email/password) while
senders needed Web3 knowledge (wallets, signing, gas).

v4 eliminates this entirely. Every user gets a Circle developer-controlled
wallet on Arc. The backend holds the keys. The backend signs x402 spend
intents server-side. The user taps a button.

```
v3 (SPLIT MODEL)                       v4 (UNIFIED MODEL)
════════════════                       ══════════════════

Recipient:                             Everyone:
  Email/password auth                    Email/password auth
  Circle dev-controlled wallet           Circle dev-controlled wallet
  on Arc                                 on Arc
  Dashboard, withdraw                    Can send AND receive
                                         Dashboard, QR code, withdraw
Sender:
  Connect MetaMask
  Sign x402 intents in browser
  No account on our platform

Frontend needs:                        Frontend needs:
  wagmi, viem, RainbowKit               React. That's it.
  Wallet connect flow                    No web3 libraries.
  Signing UX
  Chain selection
```

### What the SDK Does vs What We Build

```
WHAT THE SDK HANDLES                 WHAT WE BUILD
(don't rebuild this)                 (our actual codebase)
════════════════════                 ════════════════════

• EIP-3009 spend intent format       • Auth (email/password, JWT)
• Signature validation                • Handle registry (@alice → wallet)
• 402 payment negotiation             • Auto-funding (faucet → Gateway)
• Gateway burn/attest/mint            • Payment routing (resolve handle,
• Settlement submission                 trigger server-side signing)
• Balance tracking (Gateway-level)    • Transaction log + dashboard
• Nonce management                    • Settlement trigger + visibility
                                      • Withdrawal UX
                                      • QR codes + payment links
                                      • WebSocket real-time updates
```

Key difference from v3: the SDK's `GatewayClient.pay()` is called
**server-side** using Circle developer-controlled wallet keys. The
SDK doesn't care who signs — it validates the cryptographic signature
regardless of whether it was signed in a browser or on a server.

---

## The Four Phases

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. FUND            2. SPEND          3. SETTLE       4. WITHDRAW   │
│  (on registration)  (off-chain)       (batched)       (on-chain)    │
│                                                                      │
│  User signs up.     User taps "Pay"   Backend calls   User taps     │
│  Backend creates    Backend signs     SDK settle().   "Withdraw"    │
│  wallet, funds      x402 intent       Gateway settles Backend calls │
│  from faucet,       server-side.      on Arc.         SDK withdraw()│
│  deposits into      Instant.                          Mints on any  │
│  Gateway.           Gasless.                          chain.        │
│  Automatic.         One tap.                                        │
│                                                                      │
│  SDK:               SDK:              SDK:            SDK:          │
│  Circle Wallets     GatewayClient     BatchFacili-    GatewayClient │
│  API + Gateway      .pay() called     tatorClient     .withdraw()   │
│  Client             server-side       .settle()                     │
│                                                                      │
│  ┌──────┐          ┌──────┐          ┌──────┐       ┌──────┐      │
│  │Sign  │──►Wallet │ "Pay"│──►Server │settle│──►    │"With-│──►   │
│  │up    │  +Fund   │ tap  │  signs   │ ()   │ Arc   │draw" │ Any  │
│  │email │  +Deposit│      │  intent  │      │       │ tap  │chain │
│  └──────┘          └──────┘          └──────┘       └──────┘      │
│                                                                      │
│  User sees:        User sees:        User sees:     User sees:     │
│  "Welcome!         "Paid! ✅"        "Settled ✅"    "Withdrawn ✅"  │
│   Balance: $10"    (0.5s)            (badge on txs) (tx hash)      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```


### Phase 1: FUND (Automatic, On Registration)

When a user signs up, the backend handles everything:
1. Creates a Circle developer-controlled wallet on Arc Testnet
2. Calls the Circle Faucet API to fund the wallet with testnet USDC
3. Deposits that USDC into Gateway (0.5s finality on Arc)

The user sees a loading screen, then "Welcome! Balance: $10.00."

```
User signs up
  │
  ▼
Backend:
  1. POST /wallets → Circle creates wallet on Arc
     wallet_id: "w-123", address: "0xB2..."
  
  2. POST /faucet → $10 testnet USDC to 0xB2...
     (Arc Testnet, near-instant)
  
  3. approve(Gateway, $10) + deposit($10)
     → signed by backend using developer-controlled key
     → 0.5s finality on Arc
  
  4. GatewayClient confirms balance: $10.00
  
  ▼
User's dashboard:
  Handle: @bob
  Balance: $10.00
  Ready to send and receive.
```

For production, step 2 would be replaced by the user transferring USDC
to their wallet address or buying via a fiat on-ramp. For testnet, the
faucet is free and instant.


### Phase 2: SPEND (Off-Chain, Instant, One Tap)

When @bob pays @alice, the backend:
1. Authenticates @bob via JWT
2. Resolves @alice to her wallet address
3. Signs an x402 spend intent using @bob's Circle wallet key (server-side)
4. The SDK validates the intent
5. Backend logs the transaction, credits Alice, notifies her via WebSocket

The user taps "Pay" and sees "Paid! ✅" in under a second.

The spend intent is a real EIP-3009 `TransferWithAuthorization` — a
cryptographic commitment backed by @bob's Gateway deposit. The only
difference from v3 is that the backend signs it instead of the browser.

```
x402 SPEND (SERVER-SIDE)
════════════════════════

What happens when @bob taps "Pay @alice $5":

  Frontend                        Backend                        SDK
     │                               │                             │
     │  POST /api/pay/@alice         │                             │
     │  Auth: Bearer <jwt>           │                             │
     │  {amount: 5}                  │                             │
     │──────────────────────────────►│                             │
     │                               │                             │
     │                               │  1. JWT → this is @bob     │
     │                               │  2. @alice → 0xA1...       │
     │                               │  3. @bob balance: $10 ✓    │
     │                               │                             │
     │                               │  4. GatewayClient.pay({    │
     │                               │       to: 0xA1...,         │
     │                               │       amount: 5000000,     │
     │                               │       signerKey: <bob's    │
     │                               │         Circle wallet key> │
     │                               │     })                     │
     │                               │────────────────────────────►│
     │                               │                             │
     │                               │  Intent signed + validated  │
     │                               │  (EIP-3009, backed by       │
     │                               │   Gateway deposit)          │
     │                               │◄────────────────────────────│
     │                               │                             │
     │                               │  5. Log transaction         │
     │                               │  6. @bob:  $10 → $5        │
     │                               │  7. @alice: $0 → $5        │
     │                               │  8. WS push to Alice       │
     │                               │                             │
     │  {status: "paid",             │                             │
     │   balance: 5}                 │                             │
     │◄──────────────────────────────│                             │
     │                               │                             │
     │  "Paid @alice $5! ✅"         │                             │
     │  (~0.5s total)                │                             │
```

What makes this real (not just a database debit):
- The spend intent is cryptographically signed with @bob's private key
- The SDK validates the signature, checks nonce, verifies balance
- The intent is backed by @bob's actual USDC deposit in Gateway
- `BatchFacilitatorClient.settle()` can later settle this on-chain
- This is the exact same x402 protocol as if @bob signed in MetaMask

What the user sees: "Paid @alice $5! ✅"
What actually happened: EIP-3009 TransferWithAuthorization signed and validated.


### Phase 3: SETTLE (Batched, Periodic)

Backend calls `BatchFacilitatorClient.settle()`. The SDK handles all
Gateway mechanics. We log the result and update transaction statuses.

```
SETTLEMENT
══════════

 Our Code                   SDK                      Gateway / Arc
  │                           │                            │
  │  [Cron or "Settle Now"]   │                            │
  │                           │                            │
  │  BatchFacilitatorClient   │                            │
  │  .settle()                │                            │
  │──────────────────────────►│                            │
  │                           │  SDK handles internally:   │
  │                           │  • Collects pending        │
  │                           │    spend intents           │
  │                           │  • Submits batch to        │
  │                           │    Gateway                 │
  │                           │  • Gateway settles         │
  │                           │    on Arc Testnet          │
  │                           │───────────────────────────►│
  │                           │                            │
  │                           │  Settlement confirmed      │
  │                           │◄───────────────────────────│
  │                           │                            │
  │  {txHash, settledCount,   │                            │
  │   totalAmount}            │                            │
  │◄──────────────────────────│                            │
  │                           │                            │
  │  OUR CODE:                │                            │
  │  • Log to settlements DB  │                            │
  │  • Mark transactions as   │                            │
  │    "settled"              │                            │
  │  • Update dashboards      │                            │
  │  • Display:               │                            │
  │    "5 intents → 1 tx ✅"  │                            │
```

**Demo moment:** Three rapid payments → "Settle Now" → "3 intents, 1 on-chain
transaction on Arc." This is the visual proof of x402 batching and
Arc-as-hub.

We don't build: burn intent construction, attestation requests,
gatewayMint() calls, netting logic. The SDK handles all of it.

We do build: the trigger (cron + button), the logging, and the UI
that shows the before/after netting ratio.


### Phase 4: WITHDRAW (One Tap, Any Chain)

User taps "Withdraw," picks a chain and amount. Backend calls
`GatewayClient.withdraw()`. One SDK call.

```
WITHDRAWAL
══════════

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
  │                         │──────────────────────►│
  │                         │                       │
  │                         │  GatewayClient        │
  │                         │  .withdraw(20, {      │
  │                         │    chain: 'avaxFuji', │
  │                         │    to: '0xMyAvax'     │
  │                         │  })                   │
  │                         │                       │
  │                         │  SDK handles:          │
  │                         │  • Settle if needed    │
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

The user picks a chain from a dropdown. They don't need to understand
what "cross-chain" means. They just want their money on Avalanche.

Supported destination chains (testnet): Arc Testnet, Avalanche Fuji,
Base Sepolia, Ethereum Sepolia, HyperEVM Testnet, Sei Atlantic,
Solana Devnet, Sonic Testnet, World Chain Sepolia.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       USDC.me SYSTEM (v4)                            │
│                                                                      │
│  ┌─────────────┐    ┌───────────────────────────┐    ┌───────────┐  │
│  │             │    │  Backend (Express + Node)  │    │           │  │
│  │  Frontend   │    │                            │    │  Circle   │  │
│  │  (React)    │    │  ┌──────────────────────┐  │    │  Services │  │
│  │             │    │  │ OUR CODE:            │  │    │           │  │
│  │  • Login    │    │  │                      │  │    │ ┌───────┐ │  │
│  │  • Register │    │  │  Auth (bcrypt, JWT)  │  │    │ │Circle │ │  │
│  │  • Pay page │    │  │  Handle registry     │  │    │ │Wallets│ │  │
│  │  • Dashboard│◄──►│  │  Payment routing     │  │◄──►│ │API    │ │  │
│  │  • History  │REST│  │  Transaction log     │  │    │ └───────┘ │  │
│  │  • Withdraw │API │  │  Settlement trigger   │  │    │ ┌───────┐ │  │
│  │  • QR codes │+JWT│  │  Withdrawal handler  │  │    │ │Gateway│ │  │
│  │             │    │  │  Auto-funder         │  │    │ │API    │ │  │
│  │  ─────────  │    │  │  WebSocket server    │  │    │ └───────┘ │  │
│  │  NO web3    │    │  └──────────┬───────────┘  │    │ ┌───────┐ │  │
│  │  libraries  │    │             │              │    │ │Faucet │ │  │
│  │             │    │             ▼              │    │ │API    │ │  │
│  │             │    │  ┌──────────────────────┐  │    │ └───────┘ │  │
│  │             │    │  │ SDK LAYER:           │  │    │           │  │
│  │             │    │  │                      │  │    │ ┌───────┐ │  │
│  │             │    │  │ GatewayClient        │──┼───►│ │Arc    │ │  │
│  │             │    │  │  .pay() ← server-side│  │    │ │Testnet│ │  │
│  │             │    │  │  .withdraw()         │  │    │ └───────┘ │  │
│  │             │    │  │  .getBalance()       │  │    │           │  │
│  │             │    │  │                      │  │    │           │  │
│  │             │    │  │ createGatewayMW      │  │    │           │  │
│  │             │    │  │  (validates intents)  │  │    │           │  │
│  │             │    │  │                      │  │    │           │  │
│  │             │    │  │ BatchFacilitator     │  │    │           │  │
│  │             │    │  │  .settle()           │  │    │           │  │
│  │             │    │  └──────────────────────┘  │    │           │  │
│  │             │    │                            │    │           │  │
│  └─────────────┘    └───────────────────────────┘    └───────────┘  │
│                                                                      │
│  Pure React             All crypto here              Blockchain +    │
│  (standard web app)     (server-side only)           Circle APIs     │
└─────────────────────────────────────────────────────────────────────┘
```

The thick boundary between frontend and backend is the key architectural
decision. Everything to the left is a standard web app. Everything to
the right is blockchain infrastructure. The user never crosses that line.


---

## Complete User Flows

### Flow 1: Registration

User signs up with email, password, and a handle. Backend creates their
wallet, funds it, deposits into Gateway. User is immediately ready.

```
 User                    Frontend               Backend              Circle
  │                         │                       │                   │
  │  Sign up:               │                       │                   │
  │  email: bob@mail.com    │                       │                   │
  │  password: ****         │                       │                   │
  │  handle: bob            │                       │                   │
  │────────────────────────►│                       │                   │
  │                         │  POST /api/register   │                   │
  │                         │  {email, password,    │                   │
  │                         │   handle: "bob"}      │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  1. Validate:          │                   │
  │                         │     handle unique? ✓   │                   │
  │                         │     email unique? ✓    │                   │
  │                         │     handle format? ✓   │                   │
  │                         │                       │                   │
  │                         │  2. Hash password      │                   │
  │                         │     bcrypt(password)   │                   │
  │                         │                       │                   │
  │                         │  3. Create wallet      │                   │
  │                         │     POST /developer/   │                   │
  │                         │     wallets            │                   │
  │                         │     {blockchains:      │                   │
  │                         │      ["ARC-TESTNET"]}  │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │                   │
  │                         │                       │  wallet_id: w-123 │
  │                         │                       │  address: 0xB2..  │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  4. Fund from faucet   │                   │
  │                         │     POST /faucet       │                   │
  │                         │     {address: 0xB2..,  │                   │
  │                         │      chain: "ARC",     │                   │
  │                         │      amount: 10}       │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │                   │
  │                         │                       │  $10 USDC sent    │
  │                         │                       │  to 0xB2..        │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  5. Deposit to Gateway │                   │
  │                         │     approve + deposit  │                   │
  │                         │     (signed server-    │                   │
  │                         │      side with dev-    │                   │
  │                         │      controlled key)   │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │                   │
  │                         │                       │  ⏳ Arc: 0.5s     │
  │                         │                       │  Gateway balance: │
  │                         │                       │  $10.00           │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  6. Save to DB:        │                   │
  │                         │     handle: "bob"      │                   │
  │                         │     email: bob@...     │                   │
  │                         │     password_hash: ... │                   │
  │                         │     wallet_id: w-123   │                   │
  │                         │     wallet_addr: 0xB2  │                   │
  │                         │                       │                   │
  │                         │  7. Generate QR code   │                   │
  │                         │     for usdc.me/@bob   │                   │
  │                         │                       │                   │
  │                         │  8. Sign JWT           │                   │
  │                         │                       │                   │
  │  "Welcome @bob!"        │  {jwt, handle, qr,    │                   │
  │  Balance: $10.00        │   balance: 10}        │                   │
  │  QR code ready          │◄──────────────────────│                   │
  │◄────────────────────────│                       │                   │
```

**Timing:** Steps 3-5 take ~2-3 seconds total (wallet creation + faucet +
Arc deposit). The user sees a loading spinner, then their funded dashboard.

**What the user doesn't know:**
- They have a wallet (0xB2...) on Arc Testnet
- That wallet holds developer-controlled MPC key shards
- Their $10 is deposited in a Gateway Wallet contract
- They're ready to sign x402 spend intents

They just see: "Welcome @bob! Balance: $10.00"


### Flow 2: Login

```
 User                    Frontend               Backend
  │                         │                       │
  │  email: bob@mail.com    │                       │
  │  password: ****         │                       │
  │────────────────────────►│                       │
  │                         │  POST /api/login      │
  │                         │  {email, password}    │
  │                         │──────────────────────►│
  │                         │                       │
  │                         │  1. Find user by email│
  │                         │  2. bcrypt.compare()  │
  │                         │  3. Query balance     │
  │                         │     from Gateway      │
  │                         │  4. Sign JWT          │
  │                         │                       │
  │                         │  {jwt, handle,        │
  │                         │   balance: 8.50}      │
  │                         │◄──────────────────────│
  │                         │                       │
  │  Dashboard loads.       │                       │
  │  Balance: $8.50         │                       │
  │◄────────────────────────│                       │
```

Standard JWT auth. Nothing blockchain about it.


### Flow 3: Payment (The Core Flow)

@bob pays @alice $5. Both are registered users. No wallet interaction.

```
 @bob (phone)             Frontend               Backend              SDK
  │                          │                       │                   │
  │  Opens usdc.me/@alice    │                       │                   │
  │  (scanned QR or typed    │                       │                   │
  │   handle in search)      │                       │                   │
  │                          │                       │                   │
  │                          │  GET /api/user/alice  │                   │
  │                          │──────────────────────►│                   │
  │                          │  {handle: "alice",    │                   │
  │                          │   pay_link, avatar}   │                   │
  │                          │◄──────────────────────│                   │
  │                          │                       │                   │
  │  Payment page:           │                       │                   │
  │  ┌───────────────────┐   │                       │                   │
  │  │  Pay @alice       │   │                       │                   │
  │  │                   │   │                       │                   │
  │  │  Amount: [  $5  ] │   │                       │                   │
  │  │                   │   │                       │                   │
  │  │  [ Pay $5.00 ]    │   │                       │                   │
  │  └───────────────────┘   │                       │                   │
  │                          │                       │                   │
  │  Taps "Pay $5.00"        │                       │                   │
  │─────────────────────────►│                       │                   │
  │                          │  POST /api/pay/alice  │                   │
  │                          │  Auth: Bearer <jwt>   │                   │
  │                          │  {amount: 5}          │                   │
  │                          │─────────────────────►│                   │
  │                          │                       │                   │
  │                          │  1. Verify JWT         │                   │
  │                          │     → sender: @bob    │                   │
  │                          │                       │                   │
  │                          │  2. Prevent self-pay  │                   │
  │                          │     bob ≠ alice ✓     │                   │
  │                          │                       │                   │
  │                          │  3. Resolve @alice    │                   │
  │                          │     → wallet: 0xA1.. │                   │
  │                          │                       │                   │
  │                          │  4. Check balance     │                   │
  │                          │     @bob has $10 ✓    │                   │
  │                          │                       │                   │
  │                          │  5. SIGN x402 INTENT  │                   │
  │                          │     server-side       │                   │
  │                          │                       │                   │
  │                          │     GatewayClient     │                   │
  │                          │     .pay({            │                   │
  │                          │       to: 0xA1...,    │                   │
  │                          │       amount: 5e6,    │                   │
  │                          │       signer: <bob's  │                   │
  │                          │        Circle wallet  │                   │
  │                          │        key>           │                   │
  │                          │     })                │                   │
  │                          │──────────────────────────────────────────►│
  │                          │                       │                   │
  │                          │  Intent signed:        │                   │
  │                          │  ✓ EIP-3009 sig valid  │                   │
  │                          │  ✓ Balance sufficient  │                   │
  │                          │  ✓ Nonce valid         │                   │
  │                          │  ✓ Not expired         │                   │
  │                          │◄──────────────────────────────────────────│
  │                          │                       │                   │
  │                          │  6. Log transaction    │                   │
  │                          │     {from: "bob",     │                   │
  │                          │      to: "alice",     │                   │
  │                          │      amount: 5,       │                   │
  │                          │      status: pending} │                   │
  │                          │                       │                   │
  │                          │  7. Update balances    │                   │
  │                          │     @bob:  $10 → $5   │                   │
  │                          │     @alice: $0 → $5   │                   │
  │                          │                       │                   │
  │                          │  8. WebSocket push     │                   │
  │                          │     → Alice's browser  │                   │
  │                          │     "💰 $5 from @bob"  │                   │
  │                          │                       │                   │
  │                          │  {status: "paid",     │                   │
  │                          │   to: "alice",        │                   │
  │                          │   amount: 5,          │                   │
  │                          │   new_balance: 5}     │                   │
  │                          │◄─────────────────────│                   │
  │                          │                       │                   │
  │  "Paid @alice $5! ✅"    │                       │                   │
  │  Balance: $5.00          │                       │                   │
  │◄─────────────────────────│                       │                   │


  Meanwhile, on Alice's laptop:
  ┌──────────────────────────────────────┐
  │  Dashboard                            │
  │                                       │
  │  Balance: $5.00                       │
  │                                       │
  │  Recent:                              │
  │  💰 $5.00 from @bob  •  just now     │
  │     Status: pending settlement        │
  └──────────────────────────────────────┘
```

**What the user experiences:** Type $5 → tap "Pay" → ✅ done.
**What actually happens:** EIP-3009 TransferWithAuthorization signed
with Circle wallet MPC key, validated by x402 SDK middleware, backed
by real Gateway deposit on Arc.

**Timing breakdown:**
- JWT verification: <1ms
- Handle lookup: <1ms
- Balance check (Gateway): ~50ms
- Sign intent (Circle wallet key): ~100ms
- SDK validation: ~50ms
- DB write + WS push: ~10ms
- **Total: ~200-300ms**


### Flow 4: Batch Settlement

Triggered by cron (hourly) or "Settle Now" button (for demo).

```
 Trigger                    Our Code                SDK / Gateway
  │                            │                         │
  │  POST /api/settle          │                         │
  │  (or cron fires)           │                         │
  │───────────────────────────►│                         │
  │                            │                         │
  │                            │  Query our DB:          │
  │                            │  5 pending transactions │
  │                            │  total: $23.50          │
  │                            │                         │
  │                            │  BatchFacilitator       │
  │                            │  Client.settle()        │
  │                            │────────────────────────►│
  │                            │                         │
  │                            │  SDK handles:            │
  │                            │  • Collect pending       │
  │                            │    spend intents         │
  │                            │  • Submit to Gateway     │
  │                            │  • Gateway settles       │
  │                            │    on Arc Testnet        │
  │                            │                         │
  │                            │  {txHash: "0xabc...",    │
  │                            │   count: 5,             │
  │                            │   amount: 23.50}        │
  │                            │◄────────────────────────│
  │                            │                         │
  │                            │  Update our DB:          │
  │                            │  • 5 txns → "settled"   │
  │                            │  • Log settlement:       │
  │                            │    id, count, hash      │
  │                            │                         │
  │  {settlement_id,           │                         │
  │   intent_count: 5,         │                         │
  │   total: 23.50,            │                         │
  │   tx_hash: "0xabc...",     │                         │
  │   message: "5 intents      │                         │
  │    settled in 1 tx"}       │                         │
  │◄───────────────────────────│                         │


  Dashboard after settlement:
  ┌──────────────────────────────────────┐
  │  Recent:                              │
  │  💰 $5.00 from @bob  •  2 min ago   │
  │     Status: ✅ settled (tx: 0xabc..) │
  │  💰 $3.00 from @bob  •  5 min ago   │
  │     Status: ✅ settled (tx: 0xabc..) │
  └──────────────────────────────────────┘
```

**What the user sees:** transactions switch from "pending" to "settled ✅"
with a link to the Arc block explorer.

**What the demo audience sees:** "5 intents → 1 on-chain transaction on Arc."
That's the x402 batching story. That's Arc as the liquidity hub.


### Flow 5: Withdrawal

```
 @alice                  Frontend               Backend              SDK
  │                         │                       │                   │
  │  Dashboard → Withdraw   │                       │                   │
  │                         │                       │                   │
  │  ┌───────────────────┐  │                       │                   │
  │  │ Withdraw USDC     │  │                       │                   │
  │  │                   │  │                       │                   │
  │  │ Amount: [ $20   ] │  │                       │                   │
  │  │                   │  │                       │                   │
  │  │ To chain:         │  │                       │                   │
  │  │ [Avalanche Fuji ▼]│  │                       │                   │
  │  │                   │  │                       │                   │
  │  │ Address:          │  │                       │                   │
  │  │ [0xMyAvaxAddr...] │  │                       │                   │
  │  │                   │  │                       │                   │
  │  │ [ Withdraw ]      │  │                       │                   │
  │  └───────────────────┘  │                       │                   │
  │                         │                       │                   │
  │  Taps "Withdraw"        │                       │                   │
  │────────────────────────►│                       │                   │
  │                         │  POST /api/withdraw   │                   │
  │                         │  Auth: Bearer <jwt>   │                   │
  │                         │  {amount: 20,         │                   │
  │                         │   chain: "avaxFuji",  │                   │
  │                         │   address: "0xMy.." } │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  1. Verify JWT → alice│                   │
  │                         │  2. Check balance ✓   │                   │
  │                         │  3. Validate address  │                   │
  │                         │                       │                   │
  │                         │  4. GatewayClient     │                   │
  │                         │     .withdraw(20, {   │                   │
  │                         │       chain: avaxFuji,│                   │
  │                         │       to: 0xMy...     │                   │
  │                         │     })                │                   │
  │                         │──────────────────────────────────────────►│
  │                         │                       │                   │
  │                         │  SDK handles:          │                   │
  │                         │  • Settle pending      │                   │
  │                         │  • Gateway transfer    │                   │
  │                         │  • Mint on Avalanche   │                   │
  │                         │                       │                   │
  │                         │  {txHash: "0xdef..."}  │                   │
  │                         │◄──────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  5. Log withdrawal     │                   │
  │                         │  6. Update balance     │                   │
  │                         │                       │                   │
  │  "Withdrew $20 to       │  {tx_hash, status}    │                   │
  │   Avalanche! ✅"        │◄──────────────────────│                   │
  │  tx: 0xdef...           │                       │                   │
  │◄────────────────────────│                       │                   │
```

The dropdown shows chain names like "Avalanche," "Base," "Ethereum" —
not "Avalanche Fuji" or "Base Sepolia." The testnet suffixes are hidden.
The user is picking a destination, not a blockchain network.


### Flow 6: Add Funds

Testnet only. Production would use fiat on-ramp or external transfer.

```
 @bob                    Frontend               Backend              Circle
  │                         │                       │                   │
  │  Dashboard →            │                       │                   │
  │  "Add Funds"            │                       │                   │
  │                         │                       │                   │
  │  Taps "Get Free         │                       │                   │
  │   Test USDC"            │                       │                   │
  │────────────────────────►│                       │                   │
  │                         │  POST /api/fund       │                   │
  │                         │  Auth: Bearer <jwt>   │                   │
  │                         │──────────────────────►│                   │
  │                         │                       │                   │
  │                         │  1. Call faucet:       │                   │
  │                         │     $10 → @bob wallet │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  USDC delivered   │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │                         │  2. Deposit to Gateway │                   │
  │                         │     (0.5s on Arc)     │                   │
  │                         │─────────────────────────────────────────►│
  │                         │                       │  Balance updated  │
  │                         │◄─────────────────────────────────────────│
  │                         │                       │                   │
  │  Balance: $15.00        │  {new_balance: 15}    │                   │
  │  (was $5.00)            │◄──────────────────────│                   │
  │◄────────────────────────│                       │                   │
```


---

## The x402 Nanopayment Story (For Judges)

This section explains why the x402 architecture matters, even though
users never see it. This is what we show on the architecture slide and
explain during the technical Q&A.

### Why Not Just a Database?

A fair question: if the backend controls everything, why use x402 at all?
Why not just debit one row and credit another in SQLite?

```
DATABASE-ONLY APPROACH (what we DON'T do):
══════════════════════════════════════════

  @bob pays @alice $5:
    UPDATE users SET balance = balance - 5 WHERE handle = 'bob';
    UPDATE users SET balance = balance + 5 WHERE handle = 'alice';

  Problems:
  • No cryptographic proof of anything
  • Our database is the single source of truth (trusted intermediary)
  • Settlement on-chain requires us to reconstruct transfers
  • No verifiability — Alice has to trust us
  • If our DB corrupts, money is lost
  • Gateway has no idea what happened


x402 APPROACH (what we DO):
═══════════════════════════

  @bob pays @alice $5:
    1. Sign EIP-3009 TransferWithAuthorization with @bob's key
    2. SDK validates: signature, balance, nonce
    3. Intent recorded (cryptographically signed artifact)
    4. @alice credited (backed by Gateway deposit)

  Why this is better:
  • Every payment is a signed cryptographic intent
  • Gateway tracks balances and validates at settlement
  • Settlement is verifiable on-chain (tx hash on Arc)
  • The system is auditable end-to-end
  • If our DB dies, Gateway still has the intents
  • This is the pattern Circle built x402 for
```

### The Nanopayment Advantage (Why Batching Matters)

```
WITHOUT BATCHING (per-payment settlement):
══════════════════════════════════════════

  Payment 1: @bob → @alice $5    →  on-chain tx ($0.01 gas)
  Payment 2: @bob → @alice $3    →  on-chain tx ($0.01 gas)
  Payment 3: @carol → @alice $8  →  on-chain tx ($0.01 gas)
  Payment 4: @dave → @bob $12    →  on-chain tx ($0.01 gas)
  Payment 5: @carol → @bob $7    →  on-chain tx ($0.01 gas)

  5 payments = 5 on-chain transactions
  Total gas: $0.05
  Time: depends on chain finality


WITH x402 BATCHING (what we do):
════════════════════════════════

  Payment 1: @bob → @alice $5    →  signed intent (off-chain)
  Payment 2: @bob → @alice $3    →  signed intent (off-chain)
  Payment 3: @carol → @alice $8  →  signed intent (off-chain)
  Payment 4: @dave → @bob $12    →  signed intent (off-chain)
  Payment 5: @carol → @bob $7    →  signed intent (off-chain)

  settle() →
    5 intents, netted to 2 recipients:
    @alice: $5 + $3 + $8 = $16  →  1 on-chain settlement
    @bob: $12 + $7 = $19        →  1 on-chain settlement

  5 payments = 2 on-chain operations (or fewer)
  Gas: ~$0.02
  Payments were instant. Settlement is background.
```

This is the story for judges:
- Payments are instant because they're off-chain signed intents
- Settlement is efficient because intents batch and net
- Arc is the hub because all settlement lands there (fastest finality)
- Gateway handles the cross-chain mechanics
- The user sees none of this — just "Paid! ✅"


---

## Data Model

```
DATABASE SCHEMA
═══════════════

users
├── id              (TEXT, UUID, PRIMARY KEY)
├── handle          (TEXT, UNIQUE)
├── email           (TEXT, UNIQUE)
├── password_hash   (TEXT)
├── wallet_id       (TEXT, Circle wallet ID)
├── wallet_address  (TEXT, 0x on Arc)
├── created_at      (TEXT, ISO timestamp)

transactions
├── id              (TEXT, UUID, PRIMARY KEY)
├── from_handle     (TEXT, sender)
├── to_handle       (TEXT, recipient)
├── amount          (REAL, USDC)
├── intent_id       (TEXT, x402 spend intent ID)
├── status          (TEXT: pending | settled)
├── settlement_id   (TEXT, FK, null until settled)
├── created_at      (TEXT, ISO timestamp)

settlements
├── id              (TEXT, UUID, PRIMARY KEY)
├── intent_count    (INTEGER)
├── total_amount    (REAL)
├── tx_hash         (TEXT, on-chain tx on Arc)
├── trigger         (TEXT: cron | manual | withdrawal)
├── created_at      (TEXT, ISO timestamp)

withdrawals
├── id              (TEXT, UUID, PRIMARY KEY)
├── handle          (TEXT)
├── amount          (REAL)
├── destination     (TEXT, chain name)
├── dest_address    (TEXT, 0x on destination)
├── tx_hash         (TEXT, mint tx)
├── status          (TEXT: processing | completed | failed)
├── created_at      (TEXT, ISO timestamp)
```


---

## API Endpoints

```
AUTH
════

POST   /api/register
       Body: { email, password, handle }
       → Creates user + wallet + funds + Gateway deposit
       → { jwt, handle, balance, qr_code_url, pay_link }

POST   /api/login
       Body: { email, password }
       → { jwt, handle, balance }


PUBLIC
══════

GET    /api/user/:handle
       → { handle, pay_link, qr_code_url }
       (payment page uses this to display recipient)


PAYMENT (authenticated)
═══════════════════════

POST   /api/pay/:handle
       Auth: Bearer <jwt>
       Body: { amount }
       → Server-side x402 spend intent
       → { status, to, amount, new_balance }


DASHBOARD (authenticated)
═════════════════════════

GET    /api/dashboard
       Auth: Bearer <jwt>
       → { handle, balance, pending, settled,
           recent: [...], qr_code_url }

GET    /api/transactions
       Auth: Bearer <jwt>
       → [ { type, counterparty, amount, status,
              settlement_tx, timestamp } ]


WITHDRAWAL (authenticated)
══════════════════════════

POST   /api/withdraw
       Auth: Bearer <jwt>
       Body: { amount, chain, address }
       → { tx_hash, status }


FUNDING (authenticated, testnet only)
═════════════════════════════════════

POST   /api/fund
       Auth: Bearer <jwt>
       → { new_balance }


SETTLEMENT (admin / demo)
═════════════════════════

POST   /api/settle
       → { settlement_id, intent_count, total_amount, tx_hash }

GET    /api/settlement/:id
       → { status, intent_count, total_amount, tx_hash }
```


---

## Why This Architecture Wins

```
WHAT JUDGES WANT                   HOW WE DELIVER
════════════════                   ════════════════

Arc as liquidity hub?              All wallets live on Arc.
                                   All settlements land on Arc.
                                   Fastest finality = best hub.

Uses Gateway?                      Deposits, settlement, and
                                   withdrawals all through Gateway.
                                   Triple integration.

Uses Circle Wallets?               Every user gets a developer-
                                   controlled wallet on Arc.
                                   Created via API at signup.

Uses x402 Batching SDK?            Every payment is a real x402
                                   spend intent (server-side).
                                   Batch settlement via settle().
                                   This IS the nanopayment pattern.

Chain abstraction?                 Users don't even know they're
                                   on a blockchain. Withdraw to
                                   any chain from a dropdown.
                                   Total abstraction.

Real product?                      Email signup. Tap to pay.
                                   QR codes. Dashboard.
                                   This is Venmo.

Demo accessibility?                Judges can try it on their
                                   phones. No MetaMask needed.
                                   No testnet setup.

Technical depth?                   x402 protocol, EIP-3009,
                                   server-side intent signing,
                                   batch settlement, netting,
                                   cross-chain withdrawal,
                                   developer-controlled wallets,
                                   auto-funding pipeline.
                                   All invisible to the user.
```


---

## Demo Script (2 Minutes)

**Backstage setup:**
- Pre-register @demo (laptop) and @sender (phone)
- Both auto-funded with $50 testnet USDC
- Both logged in

**Live:**

0:00  *"This is USDC.me. I signed up with email and a handle. No wallets.
       No MetaMask. No seed phrases."*

      Show @demo dashboard. Balance: $50. QR code visible.

0:15  Pick up phone (logged in as @sender). Scan QR.
      Payment page: "Pay @demo"
      Type $5. Tap "Pay."

0:25  ✅ Instant. Laptop dashboard: "💰 $5 from @sender"

      *"That was a real x402 spend intent — EIP-3009, signed with a
       Circle developer-controlled wallet, validated by the SDK. The
       user just tapped a button."*

0:40  Two more payments: $3, then $8. Rapid-fire.
      ✅ Balance ticks: $55 → $58 → $66.

      *"Every payment is a signed intent. Off-chain. Instant. I can
       stack them all day."*

0:55  Switch to settlement view.
      *"Three payments, all off-chain. Let's settle."*
      Tap "Settle Now."

      Result: "3 intents settled. 1 on-chain tx. Arc Testnet."
      Show tx hash.

      *"Three payments. One transaction on Arc. That's x402 batching
       and Arc as the liquidity hub."*

1:15  Tap "Withdraw" → $10 → Avalanche → paste address.
      Tap "Withdraw."

      *"Now I want USDC on Avalanche. One tap."*
      Tx hash appears.

      *"Gateway mints on Avalanche. Any of nine chains."*

1:35  *"Zero Web3 UX. Full x402 pipeline. Every payment is a real
       cryptographic intent backed by Gateway deposits. Batch
       settlement on Arc. Cross-chain withdrawal via Gateway.
       Circle Wallets, Gateway, and x402 SDK — all invisible.*

      *One handle. One tap. That's USDC.me."*

2:00  End.