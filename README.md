# USDC-ME

**One handle. Instant USDC. Zero gas.**

USDC-ME is a gasless stablecoin payment platform built on [Circle's x402 batching protocol](https://developers.circle.com/). Claim a personal `@handle`, send and receive USDC instantly, accept merchant payments via API, and withdraw to 9+ chains — all without paying gas fees.

**Live at [https://www.usdc-me.xyz/](https://www.usdc-me.xyz/)**

## Features

- **Personal payment handles** — Claim `@yourname` and share a single link to receive USDC from anyone
- **Zero gas fees** — Payments are x402 spend intents signed off-chain; gas is batched and covered by the network
- **No wallet setup** — A smart wallet is generated at signup, encrypted client-side. No seed phrases, no browser extensions
- **Merchant API** — Accept USDC on your site with a simple REST API and webhook callbacks
- **Embeddable widget** — Drop-in `<script>` tag for a "Pay with USDC-ME" button on any site
- **Cross-chain withdrawals** — Withdraw USDC to Arc, Base, Ethereum, Avalanche, Solana, Polygon, Arbitrum, Optimism, and Noble
- **QR code payments** — Generate and scan QR codes for instant P2P transfers
- **Password recovery** — Dual-password encryption allows account recovery without server-side key access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS 4 + Shadcn/ui |
| Blockchain | Viem + Circle x402 Batching SDK |
| Auth & DB | Supabase (PostgreSQL) |
| Encryption | AES-GCM + PBKDF2 (client-side) |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Environment Variables

Create a `.env` file in `Frontend/usdc-me/`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_FRONTEND_URL=https://www.usdc-me.xyz
ADMIN_PASSWORD=your_admin_password
```

### Install & Run

```bash
# Frontend
cd Frontend/usdc-me
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`.

### Merchant Demo

A standalone demo shop is included to demonstrate the merchant integration:

```bash
cd merchant-demo
pnpm install
pnpm dev
```

## Project Structure

```
usdc-me/
├── Frontend/usdc-me/      # Main Next.js application
│   ├── app/               # Pages & API routes
│   ├── components/        # React components
│   ├── contexts/          # Auth context provider
│   ├── lib/               # Utilities (crypto, signing, API client)
│   └── public/            # Static assets + payment widget
├── merchant-demo/         # Example merchant integration (Vite + React)
├── TECH_DETAILS.md        # Full technical documentation
└── README.md
```

## Merchant Integration

Register at [https://www.usdc-me.xyz/merchant](https://www.usdc-me.xyz/merchant) to get an API key, then create payments from your server:

```javascript
const res = await fetch("https://www.usdc-me.xyz/api/payments/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "your_api_key"
  },
  body: JSON.stringify({
    amount: "10",
    description: "Product purchase",
    redirect_url: "https://your-site.com/thank-you"
  })
});

const { payment_id, payment_url } = await res.json();
// Redirect customer to payment_url or use the widget
```

### Embeddable Widget

```html
<div id="usdcme-pay" data-payment-id="pay_abc123"></div>
<script src="https://www.usdc-me.xyz/widget.js"></script>
```

### Webhooks

When a payment completes, a POST request is sent to your registered callback URL:

```json
{
  "event": "payment.completed",
  "payment_id": "pay_abc123",
  "amount": "10.00",
  "payer_address": "0x...",
  "intent_id": "uuid",
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

## How It Works

1. **User signs up** with email + password. A private key is generated and encrypted client-side (AES-GCM + PBKDF2, 600k iterations). Only encrypted blobs are stored.

2. **To send USDC**, the user signs an x402 `TransferWithAuthorization` (EIP-712) in-browser. No gas needed.

3. **The server verifies** the signature via Circle's `BatchFacilitatorClient` and stores it as a pending intent.

4. **Settlement** batches all pending intents and submits them on-chain in a single transaction.

5. **Withdrawals** use the Circle gateway to bridge USDC to the user's chosen chain.

## Security

- Private keys never leave the browser unencrypted
- PBKDF2 with 600,000 iterations for key derivation
- All x402 signatures verified server-side before acceptance
- Decrypted keys stored in `sessionStorage` only (cleared on tab close)
- Merchant API keys validated on every request

See [TECH_DETAILS.md](TECH_DETAILS.md) for the full security model and technical architecture.

## License

All rights reserved.
