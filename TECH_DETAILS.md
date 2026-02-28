# USDC-ME Technical Details

## Architecture Overview

USDC-ME is a gasless stablecoin payment platform built on Circle's x402 batching protocol. It enables instant USDC payments via personal handles (`@username`), merchant API integrations, and cross-chain withdrawals — all without users ever paying gas fees.

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Dashboard │  │ Merchant │  │ Payment Pages     │  │
│  │  /dash    │  │ /merchant│  │ /[handle], /pay/* │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
│  ┌────┴──────────────┴─────────────────┴──────────┐  │
│  │         Next.js API Routes (/api/*)            │  │
│  └────────────────────┬───────────────────────────┘  │
└───────────────────────┼─────────────────────────────┘
                        │
          ┌─────────────┼─────────────────┐
          │             │                 │
   ┌──────▼──────┐ ┌───▼──────┐ ┌────────▼────────┐
   │  Supabase   │ │ Circle   │ │  Arc Testnet    │
   │  (Auth/DB)  │ │ x402 SDK │ │  (Settlement)   │
   └─────────────┘ └──────────┘ └─────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.9.x |
| UI | Tailwind CSS + Shadcn/ui (Radix) | 4.x |
| Blockchain Client | Viem | 2.46.x |
| Payments | @circlefin/x402-batching | 1.1.x |
| Protocol | @x402/core + @x402/evm | 2.5.x |
| Auth & Database | Supabase (PostgreSQL) | 2.98.x |
| Forms | React Hook Form + Zod | 7.71.x / 3.25.x |
| QR Codes | qrcode (gen) + @zxing (scan) | 1.5.x / 0.1.x |

## Directory Structure

```
usdc-me/
├── Frontend/usdc-me/          # Main Next.js application
│   ├── app/                   # App Router pages & API routes
│   │   ├── page.tsx           # Landing page
│   │   ├── layout.tsx         # Root layout + providers
│   │   ├── register/          # User registration
│   │   ├── login/             # User login
│   │   ├── recover/           # Password recovery
│   │   ├── dashboard/         # User dashboard
│   │   ├── merchant/          # Merchant portal
│   │   ├── settings/          # User settings
│   │   ├── admin/             # Admin panel
│   │   ├── [handle]/          # Dynamic public payment pages
│   │   ├── pay/[paymentId]/   # Merchant payment pages
│   │   └── api/               # Backend API routes
│   │       ├── payments/      # Payment creation & execution
│   │       ├── wallet/        # Balance & withdrawals
│   │       ├── merchants/     # Merchant registration
│   │       ├── send-signed/   # x402 payment verification
│   │       ├── settle/        # Batch settlement
│   │       ├── intents/       # Transaction intent queries
│   │       ├── recover/       # Password recovery API
│   │       └── admin/         # Admin auth
│   ├── components/            # React components
│   │   ├── ui/                # Shadcn primitives (45+)
│   │   └── [feature].tsx      # Feature components
│   ├── contexts/              # React context providers
│   │   └── auth-context.tsx   # Global auth state
│   ├── lib/                   # Shared utilities
│   │   ├── wallet.ts          # Viem wallet client
│   │   ├── crypto.ts          # AES-GCM encryption
│   │   ├── signing.ts         # x402 EIP-712 signing
│   │   ├── chains.ts          # Supported withdrawal chains
│   │   ├── api.ts             # API client
│   │   ├── supabase.ts        # Supabase client
│   │   └── server/            # Server-only utilities
│   │       ├── supabase.ts    # Admin Supabase client
│   │       ├── gateway.ts     # Circle gateway setup
│   │       └── auth.ts        # Server auth helpers
│   ├── hooks/                 # Custom React hooks
│   ├── middleware.ts          # Route protection + CORS
│   └── public/
│       └── widget.js          # Embeddable payment widget
│
└── merchant-demo/             # Example merchant integration
    ├── src/
    │   ├── App.tsx            # Shop → Checkout → Confirmation
    │   ├── api.ts             # API integration helpers
    │   ├── config.ts          # API key & endpoints
    │   └── components/
    │       ├── ProductGrid.tsx
    │       ├── Checkout.tsx
    │       └── Confirmation.tsx
    ├── package.json
    └── vite.config.ts
```

## Core Systems

### 1. Client-Side Key Management

Private keys are generated and encrypted entirely in the browser. The server never sees plaintext keys.

**Registration flow:**
1. User signs up with email + password via Supabase Auth
2. A private key is generated client-side using `crypto.getRandomValues()`
3. The key is encrypted twice:
   - **Primary blob**: encrypted with the user's login password
   - **Recovery blob**: encrypted with a separate recovery password
4. Both encrypted blobs are stored in the `profiles` table
5. The decrypted key is cached in `sessionStorage` (cleared on tab close)

**Encryption scheme:**
```
PBKDF2(password, random_salt, 600000 iterations, SHA-256) → 256-bit AES key
AES-GCM(plaintext, key, random_12_byte_iv) → { ciphertext, iv, salt, version: 1 }
```

All values are base64-encoded for storage. The 600,000 PBKDF2 iterations provide strong brute-force resistance.

### 2. x402 Payment Protocol

Payments use Circle's x402 batching SDK for gasless, off-chain signed transfers.

**Payment signing (client-side):**
```
signX402Payment() creates an EIP-712 TransferWithAuthorization signature:
  - domain: USDC contract on Arc
  - types: { from, to, value, validAfter, validBefore, nonce }
  - signed with user's private key via Viem
  - returns: { x402Version: 2, payload: { authorization, signature } }
```

**Verification & settlement (server-side):**
1. `BatchFacilitatorClient.verify()` validates the signature
2. Transaction stored as "pending" in the database
3. `/api/settle` batches all pending transactions
4. `BatchFacilitatorClient.settle()` submits on-chain
5. Transaction status updated to "settled" with tx hash

### 3. Blockchain Configuration

**Primary chain — Arc Testnet:**
| Parameter | Value |
|-----------|-------|
| Chain ID | 5042002 |
| RPC URL | `https://arc-testnet.drpc.org` |
| USDC Address | `0x3600000000000000000000000000000000000000` |
| Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |

**Supported withdrawal chains:**
Arc, Base, Ethereum, Avalanche, Solana, Polygon, Arbitrum, Optimism, Noble

### 4. Authentication & Session Management

- **Supabase Auth** handles email/password registration and login
- **Auth Context** (`contexts/auth-context.tsx`) manages global state:
  - User info (handle, address, email)
  - Decrypted private key (from `sessionStorage`)
  - Recovery state detection
- **Middleware** protects admin routes and applies CORS headers to API routes
- **Admin auth** uses a server-side password stored in env vars with a session cookie

### 5. Merchant Integration

Merchants register via the portal and receive an API key. The integration flow:

```
1. Merchant server calls POST /api/payments/create with X-API-Key header
2. Returns: { payment_id, payment_url, expires_at }
3. Customer visits the payment URL or uses the embedded widget
4. Customer signs x402 payment in-browser
5. POST /api/payments/[paymentId]/pay submits the signed payment
6. Webhook fires to merchant's callback_url (non-blocking)
7. Customer redirected to merchant's redirect_url
```

**Widget integration:**
```html
<div id="usdcme-pay" data-payment-id="pay_abc123"></div>
<script src="https://www.usdc-me.xyz/widget.js"></script>
```

## Database Schema

### profiles
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (FK → auth.users) | Primary key |
| handle | text (unique) | User's @handle |
| wallet_address | text | Derived EVM address |
| encrypted_key_blob | jsonb | AES-GCM encrypted private key |
| recovery_key_blob | jsonb | Recovery-password encrypted key |

### merchants
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid (FK → auth.users) | Owner |
| name | text | Store name |
| wallet_address | text | Receiving address |
| api_key | text | Hashed API key |
| callback_url | text | Webhook URL |

### payment_requests
| Column | Type | Description |
|--------|------|-------------|
| id | text | Payment ID (pay_*) |
| merchant_id | uuid (FK → merchants) | Associated merchant |
| amount | numeric | USDC amount |
| description | text | Payment description |
| status | text | pending / paid / expired |
| redirect_url | text | Post-payment redirect |
| expires_at | timestamptz | Expiry time |

### transactions
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| type | text | send / merchant_payment / withdraw |
| from_address | text | Sender wallet |
| to_address | text | Recipient wallet |
| amount | numeric | USDC amount |
| status | text | pending / settled / failed |
| tx_hash | text | On-chain transaction hash |
| intent_id | text | x402 intent ID |

## API Reference

### Authentication & Recovery

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/auth` | POST | None | Admin login (returns session cookie) |
| `/api/recover/start` | POST | Supabase | Fetch encrypted key blob for recovery |
| `/api/recover/complete` | POST | Supabase | Update key blob after re-encryption |

### Payments

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/payments/create` | POST | X-API-Key | Create a merchant payment request |
| `/api/payments/[id]` | GET | None | Get payment status |
| `/api/payments/[id]/pay` | POST | Supabase | Submit signed x402 payment |
| `/api/send-signed` | POST | Supabase | Submit direct P2P signed payment |
| `/api/settle` | POST | Server | Batch-settle all pending transactions |

### Wallet

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/wallet/[addr]/balance` | GET | Supabase | Get wallet + gateway balance |
| `/api/wallet/[addr]/withdraw` | POST | Supabase | Withdraw USDC to another chain |

### Merchants

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/merchants/register` | POST | Supabase | Register a merchant account |
| `/api/merchants/me` | GET | Supabase | List user's merchant accounts |
| `/api/merchants/[id]` | GET/PATCH | Supabase | Get or update merchant details |
| `/api/merchants/[id]/payments` | GET | Supabase | List merchant's payment history |

### Intents

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/intents` | GET | Supabase | Query pending/settled spend intents |

## Environment Variables

### Public (client-side)
```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anonymous key
NEXT_PUBLIC_API_URL             # API base URL (optional, defaults to same origin)
NEXT_PUBLIC_FRONTEND_URL        # Frontend URL for merchant setup snippets
```

### Private (server-side only)
```
SUPABASE_SERVICE_ROLE_KEY       # Supabase admin key (used in API routes)
ADMIN_PASSWORD                  # Admin panel password
```

## Security Model

1. **Zero-knowledge key storage**: Private keys are encrypted client-side before storage. The server only holds encrypted blobs and cannot sign transactions.

2. **PBKDF2 key derivation**: 600,000 iterations with SHA-256 makes brute-force attacks on encrypted blobs computationally expensive.

3. **x402 signature verification**: All payment signatures are verified server-side via `BatchFacilitatorClient.verify()` before being accepted.

4. **Merchant API keys**: Random hex strings validated on every payment creation request.

5. **Session isolation**: Decrypted private keys live in `sessionStorage` only — cleared automatically when the browser tab closes.

6. **CORS middleware**: Applied to all API routes to prevent unauthorized cross-origin requests.

7. **Dual-password recovery**: Users set a separate recovery password at registration, enabling account recovery without server-side key access.
