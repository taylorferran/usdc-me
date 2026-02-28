import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generatePrivateKey } from 'viem/accounts';
import { GatewayClient } from '@circlefin/x402-batching/client';
import { BatchFacilitatorClient } from '@circlefin/x402-batching/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const app = express();
app.use(cors());
app.use(express.json());

// Arc Testnet config
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
const ARC_NETWORK = 'eip155:5042002';
const PORT = process.env.PORT || 3001;

// Pending intents — verified but NOT yet settled on-chain
interface PendingIntent {
  id: string;
  from: string;
  to: string;
  amount: string;
  payer: string;
  timestamp: string;
  status: 'pending' | 'settled';
  payload: any;
  accepted: any;
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

// Platform-level GatewayClient for read-only operations (balance queries).
// Uses a throwaway key — never signs anything user-facing.
let platformGateway: GatewayClient;

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
  // Create platform gateway with throwaway key (only for balance reads)
  const throwawayKey = generatePrivateKey();
  platformGateway = new GatewayClient({
    chain: 'arcTestnet',
    privateKey: throwawayKey,
  });

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

// ─── Balance Endpoint (no private key needed) ───────────────────────

app.get('/api/wallet/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;

    // Use platform gateway to query any address's balances
    const balances = await platformGateway.getBalances(address as `0x${string}`);

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

// ─── Withdraw Endpoint ──────────────────────────────────────────────
// Withdraws USDC from Gateway to a wallet on any supported chain.
// Accepts the user's private key to create a GatewayClient for the withdrawal.

app.post('/api/wallet/:address/withdraw', async (req, res) => {
  try {
    const { address } = req.params;
    const { amount, chain, recipient, privateKey } = req.body;

    if (!amount || !privateKey) {
      return res.status(400).json({ error: 'Amount and privateKey are required' });
    }

    const gateway = new GatewayClient({
      chain: 'arcTestnet',
      privateKey,
    });

    console.log('Withdraw request:', { address, amount, chain, recipient: recipient || 'self' });
    const withdrawOptions: any = {};
    if (chain) withdrawOptions.chain = chain;
    if (recipient) withdrawOptions.recipient = recipient;
    const result = await gateway.withdraw(
      amount,
      Object.keys(withdrawOptions).length > 0 ? withdrawOptions : undefined
    );

    // Log withdraw to DB
    const { error: dbError } = await supabase.from('transactions').insert({
      id: crypto.randomUUID(),
      type: 'withdraw',
      from_address: address,
      to_address: result.recipient,
      amount: result.formattedAmount,
      status: 'settled',
      tx_hash: result.mintTxHash,
      network: result.destinationChain,
    });
    if (dbError) {
      console.error('Failed to save withdraw to DB:', dbError.message);
    }

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

// ─── Send-Signed Endpoint ───────────────────────────────────────────
// Receives a pre-signed x402 payload from the frontend.
// Verifies the signature, stores as a pending intent.
// The frontend handles all signing — server never sees private keys.

app.post('/api/send-signed', async (req, res) => {
  try {
    const { from, to, amount, signedPayload } = req.body;

    if (!from || !to || !amount || !signedPayload) {
      return res.status(400).json({ error: 'Missing required fields: from, to, amount, signedPayload' });
    }

    const amountAtomic = Math.round(parseFloat(amount) * 1e6).toString();
    const arcKind = supportedKinds.find((k) => k.network === ARC_NETWORK);

    // Build the "accepted" payment requirements (same structure as a 402 response)
    const accepted = {
      scheme: 'exact',
      network: ARC_NETWORK,
      asset:
        (arcKind?.extra as any)?.assets?.[0]?.address ||
        arcKind?.extra?.asset ||
        ARC_USDC_ADDRESS,
      amount: amountAtomic,
      maxTimeoutSeconds: 345600,
      payTo: to,
      extra: {
        name: 'GatewayWalletBatched',
        version: '1',
        verifyingContract:
          arcKind?.extra?.verifyingContract ||
          '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
      },
    };

    const resource = {
      url: `http://localhost:${PORT}/api/send-signed`,
      description: `Send ${amount} USDC to ${to}`,
      mimeType: 'application/json',
    };

    // Construct the full payload that facilitator.verify() expects
    const fullPayload = {
      ...signedPayload,
      resource,
      accepted,
    };

    console.log(`send-signed: Verifying ${amount} USDC from ${from.slice(0, 10)} to ${to.slice(0, 10)}...`);

    const verification = await facilitator.verify(fullPayload, accepted);

    if (!verification.isValid) {
      console.error('send-signed: Verification failed:', verification.invalidReason);
      return res.status(400).json({
        error: 'Verification failed',
        reason: verification.invalidReason,
      });
    }

    console.log('send-signed: Payment verified - storing as pending intent');

    const intentId = crypto.randomUUID();
    intents.push({
      id: intentId,
      from,
      to,
      amount,
      payer: verification.payer || from,
      timestamp: new Date().toISOString(),
      status: 'pending',
      payload: fullPayload,
      accepted,
    });

    // Save to Supabase transactions table
    const { error: dbError } = await supabase.from('transactions').insert({
      id: intentId,
      type: 'send',
      from_address: from,
      to_address: to,
      amount,
      status: 'pending',
      intent_id: intentId,
      network: ARC_NETWORK,
    });

    if (dbError) {
      console.error('Failed to save transaction to DB:', dbError.message);
    }

    res.json({
      status: 'intent_queued',
      intentId,
      amount,
    });
  } catch (error) {
    console.error('send-signed error:', error);
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

    const settlementId = crypto.randomUUID();
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

          // Update transaction status in DB
          await supabase
            .from('transactions')
            .update({
              status: 'settled',
              tx_hash: settlement.transaction,
              settlement_id: settlementId,
            })
            .eq('intent_id', intent.id);

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
      id: settlementId,
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

// ─── Recovery Endpoints ─────────────────────────────────────────────
// Step 1: Fetch the encrypted recovery blob (service role bypasses RLS)
app.post('/api/recover/start', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Look up user by email using admin API
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw new Error(listError.message);

    const user = users.find((u) => u.email === email);
    if (!user) return res.status(404).json({ error: 'No account found with that email' });

    // Fetch recovery blob from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('recovery_key_blob, wallet_address')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.recovery_key_blob) {
      return res.status(400).json({ error: 'No recovery key set for this account' });
    }

    res.json({
      recovery_key_blob: profile.recovery_key_blob,
      wallet_address: profile.wallet_address,
    });
  } catch (error) {
    console.error('Recovery start failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Recovery failed', details: message });
  }
});

// Step 2: Complete recovery — reset password + update encrypted key blob
app.post('/api/recover/complete', async (req, res) => {
  try {
    const { email, newPassword, newEncryptedKeyBlob } = req.body;
    if (!email || !newPassword || !newEncryptedKeyBlob) {
      return res.status(400).json({ error: 'email, newPassword, and newEncryptedKeyBlob are required' });
    }

    // Find user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw new Error(listError.message);

    const user = users.find((u) => u.email === email);
    if (!user) return res.status(404).json({ error: 'No account found with that email' });

    // Reset Supabase auth password
    const { error: pwError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (pwError) throw new Error(`Password reset failed: ${pwError.message}`);

    // Update encrypted_key_blob in profiles
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ encrypted_key_blob: newEncryptedKeyBlob })
      .eq('id', user.id);

    if (updateError) throw new Error(`Profile update failed: ${updateError.message}`);

    console.log(`Recovery complete for ${email}`);
    res.json({ status: 'recovered' });
  } catch (error) {
    console.error('Recovery complete failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Recovery failed', details: message });
  }
});

// ─── Start Server ───────────────────────────────────────────────────

async function start() {
  await initGateway();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log('Mode: client-side signing (server never sees private keys)');
  });
}

start();
