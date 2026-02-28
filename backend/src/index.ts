import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generatePrivateKey } from 'viem/accounts';
import type { Hex } from 'viem';
import { GatewayClient } from '@circlefin/x402-batching/client';
import { BatchFacilitatorClient } from '@circlefin/x402-batching/server';

const app = express();
app.use(cors());
app.use(express.json());

// Arc Testnet config
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
const ARC_NETWORK = 'eip155:5042002';
const PORT = process.env.PORT || 3001;

// In-memory wallet store
const wallets = new Map<string, { privateKey: Hex; address: string }>();

// Pending intent log
const pendingIntents: Array<{
  from: string;
  to: string;
  amount: string;
  transaction: string;
  payer: string;
  timestamp: string;
}> = [];

// Initialize BatchFacilitatorClient for x402 settlement
const facilitator = new BatchFacilitatorClient();

// Fetch supported payment kinds from Gateway on startup
interface SupportedKind {
  scheme: string;
  network: string;
  extra?: {
    asset?: string;
    verifyingContract?: string;
    [key: string]: unknown;
  };
}
let supportedKinds: SupportedKind[] = [];

async function initGateway() {
  try {
    const supported = await facilitator.getSupported();
    supportedKinds = supported.kinds as SupportedKind[];
    console.log(
      `Gateway initialized - ${supportedKinds.length} supported payment kinds`
    );
    // Log Arc-specific info for debugging
    const arcKind = supportedKinds.find((k) => k.network === ARC_NETWORK);
    if (arcKind) {
      console.log(`Arc Testnet kind:`, JSON.stringify(arcKind, null, 2));
    } else {
      console.log(
        `Warning: No Arc Testnet kind found. Available networks:`,
        supportedKinds.map((k) => k.network)
      );
    }
  } catch (err) {
    console.error('Failed to initialize Gateway:', err);
    console.log('Using hardcoded Arc Testnet values as fallback');
  }
}

// ─── Wallet Endpoints ────────────────────────────────────────────────

// POST /api/wallet/create
app.post('/api/wallet/create', async (_req, res) => {
  try {
    const privateKey = generatePrivateKey();
    const gateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey,
    });

    wallets.set(gateway.address, { privateKey, address: gateway.address });
    res.json({ address: gateway.address });
  } catch (error) {
    console.error('Wallet creation failed:', error);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

// GET /api/wallet/:address/balance
app.get('/api/wallet/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;
    const wallet = wallets.get(address);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const gateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey: wallet.privateKey,
    });

    const balances = await gateway.getBalances();

    res.json({
      address,
      wallet: { balance: balances.wallet.formatted },
      gateway: {
        total: balances.gateway.formattedTotal,
        available: balances.gateway.formattedAvailable,
      },
    });
  } catch (error) {
    console.error('Balance check failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to check balance', details: message });
  }
});

// POST /api/wallet/:address/deposit - Deposit wallet USDC into Gateway
app.post('/api/wallet/:address/deposit', async (req, res) => {
  try {
    const { address } = req.params;
    const { amount } = req.body; // USDC string e.g. "10"
    const wallet = wallets.get(address);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const gateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey: wallet.privateKey,
    });

    const result = await gateway.deposit(amount);

    res.json({
      status: 'deposited',
      txHash: result.depositTxHash,
      amount,
    });
  } catch (error) {
    console.error('Deposit failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Deposit failed', details: message });
  }
});

// ─── x402 Payment Endpoint (Internal) ───────────────────────────────
// This implements the x402 protocol: returns 402 with payment
// requirements, then verifies + settles when the signature is provided.
// The recipient address and amount are dynamic per-request.

app.get('/x402/pay/:recipientAddress', async (req, res) => {
  try {
    const recipientAddress = req.params.recipientAddress;
    const amountUsdc = req.query.amount as string;
    const amountAtomic = Math.round(parseFloat(amountUsdc) * 1e6).toString();

    const paymentSignature = req.headers['payment-signature'] as
      | string
      | undefined;

    // ── No signature: return 402 with payment requirements ──
    if (!paymentSignature) {
      const arcKind = supportedKinds.find((k) => k.network === ARC_NETWORK);

      console.log(
        `x402: 402 for ${amountUsdc} USDC to ${recipientAddress} (supportedKinds: ${supportedKinds.length}, arcKind: ${!!arcKind})`
      );

      const accepts = [
        {
          scheme: 'exact',
          network: ARC_NETWORK,
          asset:
            (arcKind?.extra as any)?.assets?.[0]?.address ||
            arcKind?.extra?.asset ||
            ARC_USDC_ADDRESS,
          amount: amountAtomic,
          maxTimeoutSeconds: 345600, // 4 days for batching
          payTo: recipientAddress,
          extra: {
            name: 'GatewayWalletBatched',
            version: '1',
            verifyingContract:
              arcKind?.extra?.verifyingContract ||
              '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
          },
        },
      ];

      const resourceUrl = `http://localhost:${PORT}/x402/pay/${recipientAddress}?amount=${amountUsdc}`;

      const paymentRequired = {
        x402Version: 2,
        error: 'Payment required',
        resource: {
          url: resourceUrl,
          description: `Send ${amountUsdc} USDC to ${recipientAddress}`,
          mimeType: 'application/json',
        },
        accepts,
      };

      // Set both header AND body - GatewayClient reads from body
      res.setHeader(
        'PAYMENT-REQUIRED',
        Buffer.from(JSON.stringify(paymentRequired)).toString('base64')
      );
      return res.status(402).json(paymentRequired);
    }

    // ── Has signature: verify and settle ──
    const decoded = JSON.parse(
      Buffer.from(paymentSignature, 'base64').toString()
    );

    console.log('x402: Received payment signature, settling...');
    console.log('x402: accepted:', JSON.stringify(decoded.accepted, null, 2));

    // Pass full payload + accepted requirements (as the digital-dungeon example does)
    const settlement = await facilitator.settle(decoded, decoded.accepted);

    console.log('x402: Settlement result:', JSON.stringify(settlement, null, 2));

    if (!settlement.success) {
      console.error('x402: Settlement failed:', settlement.errorReason);
      return res.status(402).json({
        error: 'Settlement failed',
        reason: settlement.errorReason,
      });
    }

    // Settlement queued in Gateway batch
    const paymentResponse = Buffer.from(
      JSON.stringify({
        success: true,
        transaction: settlement.transaction,
        network: decoded.accepted?.network,
        payer: settlement.payer,
      })
    ).toString('base64');

    res.setHeader('PAYMENT-RESPONSE', paymentResponse);
    res.json({
      status: 'settled',
      to: recipientAddress,
      amount: amountUsdc,
      transaction: settlement.transaction,
      payer: settlement.payer,
    });
  } catch (error) {
    console.error('x402 payment endpoint error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Payment failed', details: message });
  }
});

// ─── Send Endpoint ──────────────────────────────────────────────────
// Uses the sender's GatewayClient to pay the x402 endpoint above.
// GatewayClient handles the full 402 negotiate → sign → retry flow.

app.post('/api/send', async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    const wallet = wallets.get(from);
    if (!wallet) {
      return res.status(404).json({ error: 'Sender wallet not found' });
    }

    // Create a GatewayClient with the sender's key
    const senderGateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey: wallet.privateKey,
    });

    // Pay the x402-protected endpoint (server calls itself)
    // GatewayClient will: GET → 402 → sign intent → retry with signature → 200
    const result = await senderGateway.pay<{
      status: string;
      to: string;
      amount: string;
      transaction: string;
      payer: string;
    }>(`http://localhost:${PORT}/x402/pay/${to}?amount=${amount}`);

    // Log the pending intent
    pendingIntents.push({
      from,
      to,
      amount,
      transaction: result.transaction,
      payer: result.data.payer || from,
      timestamp: new Date().toISOString(),
    });

    res.json({
      status: 'intent_queued',
      transaction: result.transaction,
      amount: result.formattedAmount,
      data: result.data,
    });
  } catch (error) {
    console.error('Send failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Send failed', details: message });
  }
});

// ─── Intents Endpoint ───────────────────────────────────────────────

app.get('/api/intents', (_req, res) => {
  res.json(pendingIntents);
});

// ─── Start Server ───────────────────────────────────────────────────

async function start() {
  await initGateway();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start();
