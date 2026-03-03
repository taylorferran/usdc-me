# USDC-ME Business Proposal

## What is USDC-ME

USDC-ME is a payment platform built on Circle's x402 protocol on Arc. Users sign up with an email, get a wallet, and send USDC to handles or QR codes. Merchants integrate with a REST API and an embeddable checkout widget. The user never needs to know they're using crypto.

## How it works

Payments are signed intents, not on-chain transactions. When a user pays, they sign an EIP-712 spend intent in their browser. That intent is verified and queued. Intents settle in batches, meaning hundreds or thousands of payments resolve in a single on-chain transaction. The per-payment cost approaches zero regardless of amount.

## The fee model

### For customers

Customers load their balance once via a fiat onramp (credit card, bank transfer). The onramp provider charges roughly 1%. After that, every payment they make on the platform costs nothing. No per-transaction fees. No gas fees. One deposit funds unlimited payments.

### For merchants

Merchants pay nothing to receive payments. No per-transaction cut, no monthly fee, no setup cost. They integrate with a simple API, receive payments into their balance, and withdraw to fiat whenever they choose. Revenue comes from a fee on merchant withdrawals/offramps.

### Why this works

Traditional payment processors charge per transaction. Stripe takes 2.9% + $0.30 on every single payment. That model punishes high-volume merchants and makes small payments impossible.

USDC-ME charges at the edges (onramp and offramp), not in the middle. The more transactions that flow through the system between deposits and withdrawals, the cheaper it gets for everyone.

## Comparison: USDC-ME vs Stripe

### Merchant doing $10,000/month across 1,000 transactions

**Stripe:**
- 1,000 x (2.9% + $0.30) = ~$3,200/month in fees
- Merchant receives ~$6,800

**USDC-ME:**
- Customer onramp cost: ~$100 total (1% spread across all customers)
- Merchant withdrawal fee: depends on rate, but even at 1% = $100
- Total system cost: ~$200
- Merchant receives ~$9,900

### Merchant selling $0.05 digital goods, 50,000 sales/month ($2,500 revenue)

**Stripe:**
- Not viable. $0.30 minimum fee per transaction exceeds the product price.
- Stripe fees would be 50,000 x $0.30 = $15,000 on $2,500 revenue. Impossible.

**USDC-ME:**
- Customer onramp: ~$25 total
- Merchant withdrawal: 1% of $2,500 = $25
- Total system cost: ~$50
- Merchant receives ~$2,475

### Single $100 purchase

**Stripe:**
- $3.20 fee (2.9% + $0.30)

**USDC-ME:**
- Customer onramp: ~$1 (if this is their first deposit)
- If already funded: $0
- Merchant withdrawal fee on that $100: $1 at 1%
- Total: $1-$2

## Where USDC-ME wins clearly

1. **High-volume merchants.** The more transactions between deposit and withdrawal, the more savings compound. A merchant processing 10,000 payments/month saves thousands compared to Stripe.

2. **Small payments.** Anything under $10 is significantly cheaper. Anything under $1 is a market that doesn't exist with traditional processors. USDC-ME can process payments of $0.001 with no economic penalty.

3. **Repeat customers.** A customer who deposits once and makes many purchases over time pays the onramp fee once. Every subsequent payment is free. Stripe charges on every transaction regardless.

4. **New business models.** Per-article paywalls, per-API-call billing, in-app micropayments, machine-to-machine payments, pay-per-use anything. These categories are impossible with a $0.30 minimum fee. USDC-ME makes them viable.

## Where traditional processors still have advantages

- **Trust and brand recognition.** Stripe is a known name. Merchants trust it. This takes time to build.
- **Compliance and tooling.** Stripe handles tax reporting, disputes, chargebacks, PCI compliance, and regulatory requirements across dozens of countries. USDC-ME would need to build or partner for these.
- **Customer acquisition.** Everyone has a credit card. Not everyone has a USDC balance yet. The onramp step is friction, even at 1%.

These are solvable problems, not architectural limitations.

## Payment security

Merchant payments are settled immediately on-chain before the webhook fires. The merchant only gets notified after the money is confirmed. No intent-settlement gap, no chargeback risk from unfunded intents.

P2P payments between platform users batch normally, since both parties are on the platform and failed settlements are recoverable.

## Revenue model

1. **Merchant withdrawal fees.** Flat percentage on offramp to fiat. This is the primary revenue source.
2. **Premium merchant features.** Analytics dashboards, custom branding on checkout, priority settlement, higher API rate limits.
3. **Onramp margin.** Potential to negotiate better rates with onramp providers at volume and keep a spread.

## Why now

Circle released the x402 batching protocol for Arc. This is the first intent-based payment infrastructure that separates signing from settlement at the protocol level. Before x402, every USDC transfer was an on-chain transaction with gas costs. x402 makes the batch-and-settle model possible. USDC-ME is the first application layer built on top of it.

## What's built

- Consumer app (PWA, mobile-first): signup, handles, QR payments, balance management, cross-chain withdrawals to 9 chains
- Merchant API: payment creation, embeddable widget, webhook callbacks
- Admin panel: batch settlement, transaction monitoring
- Demo merchant shop showing full integration

Live at https://www.usdc-me.xyz
