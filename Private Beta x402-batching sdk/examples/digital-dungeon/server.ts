/**
 * The Digital Dungeon - Seller Server (x402 + Gateway Integration)
 *
 * This file demonstrates how to integrate x402 batched payments via Gateway.
 * Game logic is handled separately in gameService.ts
 *
 * Key x402 concepts shown:
 *   1. Low-level: BatchFacilitatorClient for custom payment flows
 *   2. High-level: createGatewayMiddleware for simple routes
 *
 * This example uses the LOW-LEVEL approach for custom game logic.
 * For simple APIs, see simple.ts which uses the middleware approach.
 *
 * Run with: npm start
 */

import express from 'express';
import 'dotenv/config';

// ============================================================================
// X402 GATEWAY SDK IMPORTS
// ============================================================================

// Low-level client for custom payment flows
import { BatchFacilitatorClient } from '@circlefin/x402-batching/server';

// Helper for parsing prices
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { AssetAmount, Network, Price } from '@x402/core/types';

// NOTE: For simple use cases, you can use createGatewayMiddleware instead:
// import { createGatewayMiddleware } from '@circlefin/x402-batching/server';
// const gateway = createGatewayMiddleware({ sellerAddress, network });
// app.get('/resource', gateway.require('$0.01'), handler);

// ============================================================================
// GAME SERVICE (separate from payment logic)
// ============================================================================

import {
  getGameStatus,
  resetState,
  findChoice,
  applyChoice,
  isGameOver,
} from './gameService';

// ============================================================================
// CONFIGURATION
// ============================================================================

const app = express();
app.use(express.json());

// Network configuration
// TODO: Once Gateway API includes `asset` in /supported response, fetch dynamically
const USDC_DECIMALS = 6;

// USDC addresses per network (temporary until Gateway API returns this)
const NETWORK_USDC: Record<string, string> = {
  'eip155:5042002': '0x3600000000000000000000000000000000000000', // Arc Testnet
};

// Server configuration
const GATEWAY_URL = process.env.GATEWAY_URL;
const SELLER_ADDRESS =
  process.env.SELLER_ADDRESS || '0x96A2F92bE18D7D976672a271273fA0eB18BaFF3a';
const PORT = process.env.PORT || 3001;

// ============================================================================
// X402 SETUP
// ============================================================================

/**
 * BatchFacilitatorClient handles communication with Gateway for:
 *   - getSupported(): Fetches supported payment kinds
 *   - verify(): Verifies a payment signature
 *   - settle(): Settles the payment (batched, gasless)
 */
const gatewayClient = new BatchFacilitatorClient({
  url: GATEWAY_URL,
});

/**
 * ExactEvmScheme parses human-readable prices like "$0.01" into token units.
 */
const evmScheme = new ExactEvmScheme();

// Register money parser for supported networks
evmScheme.registerMoneyParser(
  async (amount: number, network: Network): Promise<AssetAmount | null> => {
    const usdcAddress = NETWORK_USDC[network];
    if (usdcAddress) {
      const tokenAmount = Math.round(amount * Math.pow(10, USDC_DECIMALS));
      return {
        amount: tokenAmount.toString(),
        asset: usdcAddress,
        extra: { name: 'USDC', version: '2' },
      };
    }
    return null;
  },
);

// ============================================================================
// SUPPORTED PAYMENT KINDS (fetched from Gateway on startup)
// ============================================================================

let supportedKinds: Awaited<ReturnType<typeof gatewayClient.getSupported>>;

async function initializeGateway() {
  supportedKinds = await gatewayClient.getSupported();
  console.log('[Gateway] Fetched supported payment kinds');
}

// ============================================================================
// X402 PAYMENT HELPERS
// ============================================================================

/**
 * Build payment requirements for a 402 response.
 * This tells the client what payment options are accepted.
 *
 * Dynamically builds requirements for all supported networks that we have USDC addresses for.
 */
async function buildPaymentRequirements(
  price: Price,
): Promise<Record<string, unknown>[]> {
  const requirements: Record<string, unknown>[] = [];

  for (const kind of supportedKinds.kinds) {
    // Only include networks we have USDC addresses for
    const usdcAddress = NETWORK_USDC[kind.network];
    if (!usdcAddress || kind.scheme !== 'exact') continue;

    const parsedPrice = await evmScheme.parsePrice(price, kind.network as Network);
    if (!parsedPrice) continue;

    requirements.push({
      scheme: 'exact',
      network: kind.network,
      asset: parsedPrice.asset,
      amount: parsedPrice.amount,
      payTo: SELLER_ADDRESS,
      maxTimeoutSeconds: 345600, // 4 days
      extra: kind.extra,
    });
  }

  return requirements;
}

/**
 * Parse the Payment-Signature header from the request.
 */
function parsePaymentHeader(header: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Verify and settle a payment via Gateway.
 * Returns the settlement result or throws on failure.
 */
async function verifyAndSettle(
  paymentPayload: Record<string, unknown>,
  requirements: Record<string, unknown>,
): Promise<{ transaction: string; payer: string }> {
  // Step 1: Verify the payment signature
  const verifyResult = await gatewayClient.verify(
    paymentPayload as unknown as Parameters<typeof gatewayClient.verify>[0],
    requirements as unknown as Parameters<typeof gatewayClient.verify>[1],
  );

  if (!verifyResult.isValid) {
    throw new Error(`Verification failed: ${verifyResult.invalidReason}`);
  }

  // Step 2: Settle the payment (batched, gasless!)
  const settleResult = await gatewayClient.settle(
    paymentPayload as unknown as Parameters<typeof gatewayClient.settle>[0],
    requirements as unknown as Parameters<typeof gatewayClient.settle>[1],
  );

  if (!settleResult.success) {
    throw new Error(`Settlement failed: ${settleResult.errorReason}`);
  }

  return {
    transaction: settleResult.transaction,
    payer: settleResult.payer || 'unknown',
  };
}

// ============================================================================
// GAME ENDPOINTS
// ============================================================================

/**
 * GET /game/status - Get current game state (no payment required)
 */
app.get('/game/status', (req, res) => {
  const player = req.query.player as string;
  if (!player) {
    return res.status(400).json({ error: 'Missing ?player=0x...' });
  }

  const status = getGameStatus(player);
  return res.json(status);
});

/**
 * POST /game/reset - Reset game (no payment required)
 */
app.post('/game/reset', (req, res) => {
  const player = (req.query.player as string) || req.body?.player;
  if (!player) {
    return res.status(400).json({ error: 'Missing ?player=0x...' });
  }

  resetState(player);
  const status = getGameStatus(player);
  return res.json({ success: true, message: 'Game reset!', ...status });
});

/**
 * GET /game/choice/:id - Make a choice (REQUIRES X402 PAYMENT)
 *
 * This is the main x402 integration point:
 *   1. No payment header -> Return 402 with requirements
 *   2. With payment header -> Verify, settle, apply choice
 */
app.get('/game/choice/:choiceId', async (req, res) => {
  const { choiceId } = req.params;
  const player = req.query.player as string;

  if (!player) {
    return res.status(400).json({ error: 'Missing ?player=0x...' });
  }

  // Check if game is over
  if (isGameOver(player)) {
    return res.status(400).json({
      error: 'Game is over! POST /game/reset to start again.',
    });
  }

  // Find the choice
  const choice = findChoice(player, choiceId);
  if (!choice) {
    return res.status(404).json({ error: `Choice "${choiceId}" not available.` });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // X402 FLOW: Check for payment header
  // ─────────────────────────────────────────────────────────────────────────

  const paymentHeader = req.headers['payment-signature'] as string | undefined;

  if (!paymentHeader) {
    // ─────────────────────────────────────────────────────────────────────
    // NO PAYMENT: Return 402 Payment Required
    // ─────────────────────────────────────────────────────────────────────
    const requirements = await buildPaymentRequirements(choice.price);

    if (requirements.length === 0) {
      return res.status(503).json({ error: 'Payment not configured' });
    }

    return res.status(402).json({
      x402Version: 2,
      error: 'Payment required',
      resource: {
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        description: `${choice.emoji} ${choice.label} - ${choice.price}`,
        mimeType: 'application/json',
      },
      accepts: requirements,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WITH PAYMENT: Verify, settle, and apply choice
  // ─────────────────────────────────────────────────────────────────────────

  const paymentPayload = parsePaymentHeader(paymentHeader);
  if (!paymentPayload) {
    return res.status(400).json({ error: 'Invalid payment header' });
  }

  const acceptedRequirements = paymentPayload.accepted as Record<string, unknown>;
  if (!acceptedRequirements) {
    return res.status(400).json({ error: 'Missing accepted requirements' });
  }

  try {
    // Verify and settle via Gateway
    const settlement = await verifyAndSettle(paymentPayload, acceptedRequirements);

    // Apply the choice to game state
    const paymentAmount = parseInt(acceptedRequirements.amount as string) || 1;
    const result = applyChoice(player, choiceId, paymentAmount);

    // Get updated game status
    const status = getGameStatus(player);

    // Return success response
    res.setHeader(
      'Payment-Response',
      Buffer.from(JSON.stringify(settlement)).toString('base64'),
    );

    return res.json({
      success: true,
      choice: {
        label: result.choiceLabel,
        emoji: result.choiceEmoji,
      },
      result: result.resultText,
      hpChange: result.hpChange,
      itemGained: result.itemGained,
      spending: result.spending,
      transaction: settlement.transaction,
      ...status,
    });
  } catch (err) {
    console.error('[Payment Error]', err);
    return res.status(402).json({
      error: 'Payment failed',
      reason: (err as Error).message,
    });
  }
});

/**
 * GET /health - Health check
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', gateway: gatewayClient.url });
});

// ============================================================================
// START SERVER
// ============================================================================

async function main() {
  await initializeGateway();

  app.listen(PORT, () => {
    console.log(`
+===============================================+
|     THE DIGITAL DUNGEON - Game Server        |
+===============================================+

Server:   http://localhost:${PORT}
Gateway:  ${gatewayClient.url}
Seller:   ${SELLER_ADDRESS}

Endpoints:
  GET  /game/status?player=0x...
  GET  /game/choice/:id?player=0x...  (402)
  POST /game/reset?player=0x...
  GET  /health
`);
  });
}

main().catch(console.error);
