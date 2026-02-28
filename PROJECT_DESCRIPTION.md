# USDC-ME

## One handle. Instant USDC. Zero gas.

USDC-ME is a gasless stablecoin payment platform built on Circle's x402 batching protocol. It turns USDC into something you can actually use for everyday payments, merchant checkout, and programmable micropayments, all without gas fees.

## The Problem

Sending USDC on-chain costs gas. Every single transfer requires an on-chain transaction, which makes small payments economically pointless. You can't charge someone $0.10 for an API call if the transaction fee is $0.50. This kills an entire category of use cases: micropayments, pay-per-request APIs, agent-to-agent commerce, in-app tipping, and countless others.

## How We Solve It

USDC-ME uses Circle's x402 protocol to separate signing from settlement. When you send USDC on our platform, you sign an EIP-712 spend intent in your browser. That's it. No gas, no on-chain transaction. The intent gets cryptographically verified and queued. When it's time to settle, all pending intents get batched into a single on-chain transaction.

This means you could process 10,000 payments and only pay gas once.

## What We Built

**For users:** Sign up with an email, get a personal payment handle like `@yourname`, and start sending and receiving USDC instantly. No wallet extensions, no seed phrases, no gas tokens. Your private key is generated and encrypted entirely in your browser. We never see it.

**For merchants:** Register, get an API key, and accept USDC with a single REST endpoint. Embed our payment widget on your site with one script tag. Get webhook callbacks when customers pay.

**For developers and agents:** The intent-based architecture is designed for programmatic payments at scale. AI agents can pay for API calls, services can charge per-request, and the economics actually work because you're not burning gas on every interaction.

## Technical Highlights

- **Client-side key management:** Private keys encrypted with AES-GCM and PBKDF2 (600,000 iterations). Never sent to the server.
- **x402 spend intents:** Payments are EIP-712 signatures verified by Circle's BatchFacilitatorClient. No on-chain cost until settlement.
- **Batch settlement:** All pending intents settle in a single transaction through Circle's facilitator contract.
- **Cross-chain withdrawals:** Withdraw USDC to 9 chains (Ethereum, Base, Solana, Avalanche, Polygon, Arbitrum, Optimism, Noble, Arc) through Circle's gateway.
- **Full merchant API:** Payment creation, status polling, webhook callbacks, and an embeddable payment widget.

## Why This Matters

The x402 protocol unlocks a new layer for USDC. Not just transfers between wallets, but a real payment network where the cost per transaction approaches zero. USDC-ME is the application layer that makes this accessible to regular users, merchants, and software agents alike.

We're not building another wallet. We're building the payment infrastructure that makes USDC work the way money should: instant, free to send, and simple enough that you don't need to know what a blockchain is.

## Built With

Next.js 16, TypeScript, Viem, Circle x402 Batching SDK, Supabase, Tailwind CSS, Shadcn/ui

## Links

- **Live:** [https://www.usdc-me.xyz/](https://www.usdc-me.xyz/)
- **Technical Details:** [TECH_DETAILS.md](TECH_DETAILS.md)
