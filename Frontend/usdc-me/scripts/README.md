# Demo Scripts

Scripts for the hackathon demo. Run from the `Frontend/usdc-me` directory.

## Prerequisites

- Next.js dev server running (`npm run dev`)
- A wallet private key with USDC on Arc testnet
- `npx tsx` (no install needed)

## 1. Deposit into Gateway

Deposits USDC from your wallet into the Gateway contract so intents can be created and settled.

```bash
SENDER_PRIVATE_KEY=0x... AMOUNT=5 npx tsx scripts/deposit-gateway.ts
```

| Env var | Default | Description |
|---------|---------|-------------|
| `SENDER_PRIVATE_KEY` | (required) | Private key of the funded wallet |
| `AMOUNT` | `5` | USDC amount to deposit |

## 2. Bulk Payment Intents

Generates signed x402 payment intents and queues them via `/api/send-signed`. Then settle them all at once from the dashboard.

```bash
SENDER_PRIVATE_KEY=0x... npx tsx scripts/bulk-intents.ts
```

| Env var | Default | Description |
|---------|---------|-------------|
| `SENDER_PRIVATE_KEY` | (required) | Private key of the funded wallet |
| `API_URL` | `http://localhost:3001` | Next.js dev server URL |
| `INTENT_COUNT` | `50` | Number of intents to create |

Each intent is a random amount between $0.0001 and $0.01.

## Demo Flow

1. Fund your wallet with testnet USDC
2. Deposit into the gateway: `deposit-gateway.ts`
3. Generate bulk intents: `bulk-intents.ts`
4. Open dashboard → click **Settle Now** → all intents batch into one on-chain tx
