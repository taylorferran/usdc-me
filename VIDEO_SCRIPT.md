# USDC-ME Demo Video Script (3 minutes)

## Opening (15 seconds)

"What if sending USDC was as easy as Venmo, but it also worked for merchants, for AI agents, for micropayments as small as a fraction of a cent? That's USDC-ME. Built on Circle's x402 protocol. Let me show you."

## 1. Login & Dashboard (20 seconds)

*Show login flow, dashboard loads with balance and QR code*

"You sign up with just an email and password. We generate a wallet and encrypt it entirely in your browser. Your private key never touches our server. You get a personal handle, a payment link, and a QR code. Think of it like a Venmo username, but for USDC."

## 2. Deposit (15 seconds)

*Show deposit flow*

"You deposit USDC into Circle's Gateway contract on Arc. This is the only on-chain transaction you'll ever make. From here, everything is gasless."

## 3. Send USDC (25 seconds)

*Show sending USDC to another handle*

"Sending is instant. Type a handle, enter an amount, done. But here's what's actually happening: we sign an x402 spend intent in the browser using EIP-712. That intent gets cryptographically verified server-side by Circle's BatchFacilitatorClient and queued. No gas. No on-chain transaction. Just a signed promise to pay."

## 4. Intents & Settlement (30 seconds)

*Show the spend intents card, then hit settle*

"This is what makes USDC-ME fundamentally different from any other payment app. Every payment is an intent, not a transaction. They queue up and settle in batches. Hit settle, and Circle's facilitator submits them all on-chain in a single transaction.

This is the infrastructure that makes nanopayments real. You could send a thousand payments of half a cent each and settle them all at once. The cost per payment approaches zero no matter how small the amount. That's not possible with normal on-chain transfers. That's not possible with any existing payment app. This architecture is what unlocks USDC as a true medium of exchange, not just a store of value."

## 5. Merchant Flow (30 seconds)

*Show merchant registration, then switch to merchant demo shop*

"Now the same system works for merchants. Register, get an API key, and you can accept USDC payments with a single API call. Embed our widget on your checkout page with one script tag. When the customer pays, you get a webhook. Ten lines of code to accept stablecoin payments.

And because it's the same intent-based system, a merchant could sell digital goods for $0.01 each and it actually makes economic sense. No payment processor takes a 30 cent fee on a 1 cent transaction. With USDC-ME, that transaction costs effectively nothing."

*Show the demo shop checkout flow*

## 6. QR Scan to Pay (15 seconds)

*Show scanning a QR code on phone, completing payment*

"For in-person payments, scan a QR code. Camera opens, scan, confirm, paid. Same gasless signing, same instant experience."

## 7. Closing (20 seconds)

"USDC-ME is two things at once. For regular people, it's the simplest way to send and receive USDC. For developers and businesses, it's scalable payment infrastructure where the cost per transaction doesn't matter anymore. Person to person. Merchant checkout. Agent to agent. Micropayments, nanopayments, whatever you want to call them. The x402 intent architecture makes them all work. This is USDC-ME."
