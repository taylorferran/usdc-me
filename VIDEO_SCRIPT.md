# USDC-ME Demo Video Script (3 minutes)

## Opening (15 seconds)

"USDC-ME is a gasless payment platform built on Circle's x402 protocol. One handle, instant USDC, zero gas. Let me show you how it works."

## 1. Login & Dashboard (20 seconds)

*Show login flow, dashboard loads with balance and QR code*

"You sign up with just an email and password. Behind the scenes we generate a wallet and encrypt it client-side. Your private key never touches our server. Once you're in, you see your balance, your personal payment link, and your QR code."

## 2. Deposit (20 seconds)

*Show deposit flow*

"To fund your account, you deposit USDC into Circle's Gateway contract on Arc. This is the only on-chain transaction you'll ever need to make. From here, everything is gasless."

## 3. Send USDC (30 seconds)

*Show sending USDC to another handle*

"Sending is instant. I type in a handle, enter an amount, and hit send. What actually happens here is important: we sign an x402 TransferWithAuthorization in the browser using EIP-712. That signed intent gets verified server-side by Circle's BatchFacilitatorClient and stored as a pending intent. No gas was paid. No on-chain transaction happened yet."

## 4. Intents & Settlement (25 seconds)

*Show the spend intents card, then hit settle*

"This is the key innovation. Every payment creates a spend intent, not a transaction. These intents queue up and get settled in batches. When we hit settle, Circle's facilitator submits them all on-chain in one go. This is what makes the system viable for nanopayments. You could process thousands of sub-cent payments and settle them once."

## 5. Merchant Flow (30 seconds)

*Show merchant registration, then switch to merchant demo shop*

"For merchants, you register and get an API key. One API call creates a payment request. The customer gets a payment link or you embed our widget directly on your site. When they pay, you get a webhook callback. The whole integration is maybe 10 lines of code."

*Show the demo shop checkout flow*

## 6. QR Scan to Pay (20 seconds)

*Show scanning a QR code on phone, completing payment*

"And for in-person payments, you just scan someone's QR code. Camera opens, scan, confirm, done. Same gasless x402 signing under the hood."

## 7. Closing (20 seconds)

"So what we've built is a complete payment layer on top of x402. Gasless, instant, works for person-to-person, merchant checkout, and programmatic payments. The intent-based architecture means this scales to agent-to-agent micropayments, API monetization, pay-per-request models, anything where traditional transaction fees would kill the economics. This is USDC-ME."
