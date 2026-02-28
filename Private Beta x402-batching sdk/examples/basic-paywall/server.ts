/**
 * Simple Seller Example - Circle Gateway SDK
 *
 * This example demonstrates the typical seller flow with the new middleware:
 * 1. Create Gateway middleware
 * 2. Protect routes with `gateway.require('$0.01')`
 * 3. Works with GET and POST requests
 *
 * Usage:
 *   npx tsx simple.ts
 */

import express from 'express';
import { createGatewayMiddleware } from '@circlefin/x402-batching/server';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT ?? 3002;
const SELLER_ADDRESS =
  process.env.SELLER_ADDRESS ?? '0x96A2F92bE18D7D976672a271273fA0eB18BaFF3a';

// ============================================================================
// SETUP
// ============================================================================

const app = express();
app.use(express.json());

// Create Gateway middleware
// By default, accepts payments from ALL Gateway-supported chains
const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  // networks: ['eip155:5042002'], // Optional: restrict to specific chains
});

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * GET /free - Free endpoint (no payment required)
 */
app.get('/free', (_req, res) => {
  res.json({
    message: 'This endpoint is free!',
    tip: 'Try /paid for a paid endpoint.',
  });
});

/**
 * GET /paid - Paid endpoint ($0.01)
 *
 * Protected by gateway.require('$0.01')
 * - Without payment: Returns 402 Payment Required
 * - With payment: Verifies, settles, and returns content
 */
app.get('/paid', gateway.require('$0.01'), (req, res) => {
  // Payment info is available on req.payment
  const payment = req.payment;

  res.json({
    message: 'Thank you for your payment!',
    premium_content: 'This is exclusive paid content.',
    payment: {
      amount: payment?.amount,
      payer: payment?.payer,
      transaction: payment?.transaction,
    },
  });
});

/**
 * POST /generate - Generate content ($0.05)
 *
 * Shows that POST requests work just as well.
 */
app.post('/generate', gateway.require('$0.05'), (req, res) => {
  const input = req.body as { prompt?: string };
  const prompt = input?.prompt ?? 'default prompt';
  const payment = req.payment;

  res.json({
    message: 'Generated content!',
    prompt: prompt,
    result: `This is generated content based on: "${prompt}"`,
    payment: {
      amount: payment?.amount,
      transaction: payment?.transaction,
    },
  });
});

/**
 * GET /health - Health check
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    seller: SELLER_ADDRESS,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║     Simple Seller - Gateway Middleware Example     ║
╚════════════════════════════════════════════════════╝

Server:  http://localhost:${PORT}
Seller:  ${SELLER_ADDRESS}
Networks: All Gateway-supported chains

Endpoints:
  GET  /free           - Free endpoint
  GET  /paid           - $0.01 (Gateway batching)
  POST /generate       - $0.05 (Gateway batching)
  GET  /health         - Health check

Test with:
  curl http://localhost:${PORT}/free
  curl http://localhost:${PORT}/paid    # Returns 402

To pay, run in another terminal:
  cd ../buyer-script
  PRIVATE_KEY=0x... npm run simple

Get testnet USDC from: https://faucet.circle.com
`);
});
