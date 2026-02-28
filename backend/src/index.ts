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

// Pending intents — verified but NOT yet settled on-chain
interface PendingIntent {
  id: string;
  from: string;
  to: string;
  amount: string;
  payer: string;
  timestamp: string;
  status: 'pending' | 'settled';
  // Raw x402 data needed to settle later
  payload: any;
  accepted: any;
  // Filled after settlement
  transaction?: string;
}
const intents: PendingIntent[] = [];

// Settlement log
interface Settlement {
  id: string;
  intentCount: number;
  totalAmount: number;
  results: Array<{ intentId: string; success: boolean; transaction?: string; error?: string }>;
  timestamp: string;
}
const settlements: Settlement[] = [];

// Initialize BatchFacilitatorClient for x402 verification + settlement
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

// POST /api/wallet/:address/deposit
app.post('/api/wallet/:address/deposit', async (req, res) => {
  try {
    const { address } = req.params;
    const { amount } = req.body;
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

// POST /api/wallet/:address/withdraw
app.post('/api/wallet/:address/withdraw', async (req, res) => {
  try {
    const { address } = req.params;
    const { amount, chain, recipient } = req.body;
    const wallet = wallets.get(address);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const gateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey: wallet.privateKey,
    });

    console.log('Withdraw request:', { amount, chain, recipient });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withdrawOptions: any = {};
    if (chain) withdrawOptions.chain = chain;
    if (recipient) withdrawOptions.recipient = recipient;
    const result = await gateway.withdraw(amount, Object.keys(withdrawOptions).length > 0 ? withdrawOptions : undefined);
    console.log('Withdraw result (full):', JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    res.json({
      status: 'withdrawn',
      txHash: result.mintTxHash,
      amount: result.formattedAmount,
      sourceChain: result.sourceChain,
      destinationChain: result.destinationChain,
      recipient: result.recipient,
    });
  } catch (error) {
    console.error('Withdrawal failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Withdrawal failed', details: message });
  }
});

// ─── x402 Payment Endpoint (Internal) ───────────────────────────────
// Returns 402 with payment requirements, then VERIFY-ONLY on retry.
// Settlement happens later via POST /api/settle.

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
        `x402: 402 for ${amountUsdc} USDC to ${recipientAddress}`
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
          maxTimeoutSeconds: 345600,
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

      res.setHeader(
        'PAYMENT-REQUIRED',
        Buffer.from(JSON.stringify(paymentRequired)).toString('base64')
      );
      return res.status(402).json(paymentRequired);
    }

    // ── Has signature: VERIFY only (don't settle yet) ──
    const decoded = JSON.parse(
      Buffer.from(paymentSignature, 'base64').toString()
    );

    console.log('x402: Verifying payment signature...');

    const verification = await facilitator.verify(decoded, decoded.accepted);

    if (!verification.isValid) {
      console.error('x402: Verification failed:', verification.invalidReason);
      return res.status(402).json({
        error: 'Verification failed',
        reason: verification.invalidReason,
      });
    }

    console.log('x402: Payment verified - storing as pending intent');

    // Store the raw payload + accepted for later settlement
    const intentId = crypto.randomUUID();
    intents.push({
      id: intentId,
      from: decoded.accepted?.payTo ? '' : '', // filled by /api/send
      to: recipientAddress,
      amount: amountUsdc,
      payer: verification.payer || 'unknown',
      timestamp: new Date().toISOString(),
      status: 'pending',
      payload: decoded,
      accepted: decoded.accepted,
    });

    // Return success to GatewayClient (payment accepted, pending settlement)
    const paymentResponse = Buffer.from(
      JSON.stringify({
        success: true,
        transaction: intentId,
        network: decoded.accepted?.network,
        payer: verification.payer,
      })
    ).toString('base64');

    res.setHeader('PAYMENT-RESPONSE', paymentResponse);
    res.json({
      status: 'verified',
      intentId,
      to: recipientAddress,
      amount: amountUsdc,
      payer: verification.payer,
    });
  } catch (error) {
    console.error('x402 payment endpoint error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Payment failed', details: message });
  }
});

// ─── Send Endpoint ──────────────────────────────────────────────────

app.post('/api/send', async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    const wallet = wallets.get(from);
    if (!wallet) {
      return res.status(404).json({ error: 'Sender wallet not found' });
    }

    const senderGateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey: wallet.privateKey,
    });

    const result = await senderGateway.pay<{
      status: string;
      intentId: string;
      to: string;
      amount: string;
      payer: string;
    }>(`http://localhost:${PORT}/x402/pay/${to}?amount=${amount}`);

    // Update the intent with the sender address
    const intent = intents.find((i) => i.id === result.data.intentId);
    if (intent) {
      intent.from = from;
    }

    res.json({
      status: 'intent_queued',
      intentId: result.data.intentId,
      amount: result.formattedAmount,
    });
  } catch (error) {
    console.error('Send failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Send failed', details: message });
  }
});

// ─── Intents Endpoint ───────────────────────────────────────────────

app.get('/api/intents', (_req, res) => {
  res.json(
    intents.map(({ payload, accepted, ...rest }) => rest)
  );
});

// ─── Settle Endpoint ────────────────────────────────────────────────
// "Resolve Now" — settles all pending intents through Gateway.
// Gateway handles the on-chain batching and pays for gas.

app.post('/api/settle', async (_req, res) => {
  try {
    const pending = intents.filter((i) => i.status === 'pending');

    if (pending.length === 0) {
      return res.json({ message: 'No pending intents to settle', settled: 0 });
    }

    console.log(`Settling ${pending.length} pending intents...`);

    const results: Settlement['results'] = [];
    let totalAmount = 0;

    for (const intent of pending) {
      try {
        const settlement = await facilitator.settle(
          intent.payload,
          intent.accepted
        );

        if (settlement.success) {
          intent.status = 'settled';
          intent.transaction = settlement.transaction;
          totalAmount += parseFloat(intent.amount);
          results.push({
            intentId: intent.id,
            success: true,
            transaction: settlement.transaction,
          });
          console.log(
            `  Settled: ${intent.amount} USDC ${intent.from.slice(0, 8)}→${intent.to.slice(0, 8)} (tx: ${settlement.transaction})`
          );
        } else {
          results.push({
            intentId: intent.id,
            success: false,
            error: settlement.errorReason,
          });
          console.error(
            `  Failed: ${intent.amount} USDC - ${settlement.errorReason}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ intentId: intent.id, success: false, error: msg });
        console.error(`  Error settling intent ${intent.id}: ${msg}`);
      }
    }

    const settlementRecord: Settlement = {
      id: crypto.randomUUID(),
      intentCount: pending.length,
      totalAmount,
      results,
      timestamp: new Date().toISOString(),
    };
    settlements.push(settlementRecord);

    const succeeded = results.filter((r) => r.success).length;
    console.log(
      `Settlement complete: ${succeeded}/${pending.length} intents settled, ${totalAmount} USDC total`
    );

    res.json({
      settlementId: settlementRecord.id,
      settled: succeeded,
      failed: pending.length - succeeded,
      totalAmount,
      results,
    });
  } catch (error) {
    console.error('Settlement error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Settlement failed', details: message });
  }
});

// GET /api/settlements - settlement history
app.get('/api/settlements', (_req, res) => {
  res.json(settlements);
});

// ─── Start Server ───────────────────────────────────────────────────

async function start() {
  await initGateway();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start();
