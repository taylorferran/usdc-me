# Migration Guide: Adding Gateway Support to Existing x402 Applications

This guide helps you add Circle Gateway gas free payments to an existing x402 application.

## Prerequisites

- An existing x402 application using `@x402/core` or `@x402/express`
- Node.js v18+

## 1. Install the SDK

```bash
npm install @circlefin/x402-batching
```

This installs the SDK along with its required peer dependencies (`@x402/core`, `viem`). If you need `CompositeEvmScheme` or `GatewayEvmScheme`, also install the optional peer dependency:

```bash
npm install @x402/evm
```

## 2. Server-Side: Add Gateway Support

### Before (Standard x402 Only)

```typescript
import { x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

const server = new x402ResourceServer([
  new HTTPFacilitatorClient({ url: 'https://facilitator.example.com' }),
]);
server.register('eip155:*', new ExactEvmScheme());
await server.initialize();
```

### After (Standard + Gateway)

```typescript
import { x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import {
  BatchFacilitatorClient,
  GatewayEvmScheme,
} from '@circlefin/x402-batching/server';

const server = new x402ResourceServer([
  new HTTPFacilitatorClient({ url: 'https://facilitator.example.com' }),
  new BatchFacilitatorClient(), // Add Gateway facilitator
]);
// GatewayEvmScheme extends ExactEvmScheme — use it instead
server.register('eip155:*', new GatewayEvmScheme());
await server.initialize();
```

**What changed:**
- Added `BatchFacilitatorClient` to the facilitators array
- Replaced `ExactEvmScheme` with `GatewayEvmScheme` (which extends it)

## 3. Client-Side: Add Gateway Payment Support

### Option A: Gateway Only (Simplest)

If you only need Gateway payments, use `GatewayClient`:

```typescript
import { GatewayClient } from '@circlefin/x402-batching/client';

const client = new GatewayClient({
  chain: 'baseSepolia',
  privateKey: '0x...',
});

// Deposit USDC into Gateway (one-time)
await client.deposit('10');

// Pay for resources gas free
const { data } = await client.pay('https://api.example.com/resource');
```

### Option B: Both Gateway + Standard (CompositeEvmScheme)

If you need to support both Gateway and standard on-chain payments:

```typescript
import { x402Client } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import {
  CompositeEvmScheme,
  BatchEvmScheme,
} from '@circlefin/x402-batching/client';

// Create a composite scheme that routes to the right handler
const composite = new CompositeEvmScheme(
  new BatchEvmScheme(signer),     // Handles Gateway batched payments
  new ExactEvmScheme(signer),     // Handles standard on-chain payments
);

// Register once — automatically routes based on payment requirements
client.register('eip155:*', composite);
```

### Option C: Register Batch Scheme Alongside Existing

If you have existing scheme registrations and just want to add batch support:

```typescript
import { registerBatchScheme } from '@circlefin/x402-batching/client';

// Add batch scheme to existing x402 client
registerBatchScheme(client, { signer: account });
```

## 4. Verify the Integration

### Server-Side Check

After initializing, the server will now return Gateway batching options in 402 responses. You can verify by checking the `accepts` array:

```typescript
// The 402 response should include entries with:
extra.name === "GatewayWalletBatched"
```

### Client-Side Check

```typescript
const support = await gatewayClient.supports('https://your-api.com/resource');
console.log('Gateway supported:', support.supported);
```
