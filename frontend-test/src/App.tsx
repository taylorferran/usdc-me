import { useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3001/api';

interface WalletBalance {
  address: string;
  wallet: { balance: string };
  gateway: { total: string; available: string };
}

interface Intent {
  id: string;
  from: string;
  to: string;
  amount: string;
  payer: string;
  timestamp: string;
  status: 'pending' | 'settled';
  transaction?: string;
}

interface SettlementResult {
  settlementId: string;
  settled: number;
  failed: number;
  totalAmount: number;
}

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSettlement, setLastSettlement] = useState<SettlementResult | null>(null);

  // Send form state
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState('');

  const createWallet = async () => {
    setLoading('create');
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wallet/create`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create wallet');
      const data = await res.json();
      setAddress(data.address);
      setBalance(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const checkBalance = async () => {
    if (!address) return;
    setLoading('balance');
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wallet/${address}/balance`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || 'Failed to fetch balance');
      }
      const data: WalletBalance = await res.json();
      setBalance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const deposit = async () => {
    if (!address || !depositAmount) return;
    setLoading('deposit');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/wallet/${address}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: depositAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);
      setSuccess(`Deposited ${depositAmount} USDC to Gateway (tx: ${data.txHash})`);
      setDepositAmount('');
      checkBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const send = async () => {
    if (!address || !sendTo || !sendAmount) return;
    setLoading('send');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: address, to: sendTo, amount: sendAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);
      setSuccess(`Sent ${sendAmount} USDC to ${sendTo.slice(0, 10)}... (intent queued)`);
      setSendTo('');
      setSendAmount('');
      checkBalance();
      fetchIntents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const fetchIntents = async () => {
    try {
      const res = await fetch(`${API_URL}/intents`);
      const data: Intent[] = await res.json();
      setIntents(data);
    } catch {
      // silent
    }
  };

  const settleNow = async () => {
    setLoading('settle');
    setError(null);
    setSuccess(null);
    setLastSettlement(null);
    try {
      const res = await fetch(`${API_URL}/settle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);

      if (data.settled === 0 && data.failed === 0) {
        setSuccess('No pending intents to settle.');
      } else {
        setLastSettlement(data);
        setSuccess(
          `Settled ${data.settled} intent${data.settled !== 1 ? 's' : ''} (${data.totalAmount} USDC) on Arc`
        );
      }
      fetchIntents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const pendingCount = intents.filter((i) => i.status === 'pending').length;

  return (
    <div className="container">
      <h1>USDC.me</h1>
      <p className="subtitle">Universal USDC Payments on Arc via x402</p>

      {!address ? (
        <div className="card">
          <button onClick={createWallet} disabled={loading === 'create'}>
            {loading === 'create' ? 'Creating...' : 'Create Wallet'}
          </button>
          <p className="hint">
            Creates a developer-controlled wallet on Arc Testnet
          </p>
        </div>
      ) : (
        <>
          {/* Wallet Info */}
          <div className="card">
            <div className="wallet-info">
              <label>Your Wallet Address</label>
              <div className="address">{address}</div>
            </div>

            <button onClick={checkBalance} disabled={loading === 'balance'}>
              {loading === 'balance' ? 'Checking...' : 'Check Balance'}
            </button>

            {balance && (
              <div className="balances">
                <div className="balance-row">
                  <span>Wallet USDC</span>
                  <span className="amount">{balance.wallet.balance}</span>
                </div>
                <div className="balance-row">
                  <span>Gateway Total</span>
                  <span className="amount">{balance.gateway.total}</span>
                </div>
                <div className="balance-row">
                  <span>Gateway Available</span>
                  <span className="amount highlight">{balance.gateway.available}</span>
                </div>
              </div>
            )}
          </div>

          {/* Deposit to Gateway */}
          <div className="card">
            <h3>Deposit to Gateway</h3>
            <p className="hint">
              Move USDC from your wallet into Gateway (required before sending via x402)
            </p>
            <div className="form-row">
              <input
                type="text"
                placeholder="Amount (e.g. 5)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button onClick={deposit} disabled={loading === 'deposit' || !depositAmount}>
                {loading === 'deposit' ? 'Depositing...' : 'Deposit'}
              </button>
            </div>
          </div>

          {/* Send via x402 */}
          <div className="card">
            <h3>Send USDC (x402)</h3>
            <p className="hint">
              Signs an x402 spend intent off-chain (instant, gasless)
            </p>
            <input
              type="text"
              placeholder="Recipient address (0x...)"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
            />
            <div className="form-row">
              <input
                type="text"
                placeholder="Amount (e.g. 1.5)"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
              />
              <button onClick={send} disabled={loading === 'send' || !sendTo || !sendAmount}>
                {loading === 'send' ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          {/* Intents + Settlement */}
          <div className="card">
            <div className="intents-header">
              <h3>
                Spend Intents
                {pendingCount > 0 && (
                  <span className="badge">{pendingCount} pending</span>
                )}
              </h3>
              <button className="secondary small" onClick={fetchIntents}>
                Refresh
              </button>
            </div>

            {intents.length === 0 ? (
              <p className="hint">No intents yet. Send USDC to create one.</p>
            ) : (
              <div className="intents-list">
                {intents.map((intent) => (
                  <div
                    key={intent.id}
                    className={`intent-row ${intent.status === 'settled' ? 'settled' : ''}`}
                  >
                    <div className="intent-info">
                      <span className="intent-amount">{intent.amount} USDC</span>
                      <span className="intent-addresses">
                        {intent.from ? `${intent.from.slice(0, 8)}...` : '???'} →{' '}
                        {intent.to.slice(0, 8)}...
                      </span>
                    </div>
                    <span className={`intent-status ${intent.status}`}>
                      {intent.status === 'settled' ? 'Settled' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Settle Now button */}
            <button
              className="settle-btn"
              onClick={settleNow}
              disabled={loading === 'settle' || pendingCount === 0}
            >
              {loading === 'settle'
                ? 'Settling...'
                : `Settle Now (${pendingCount} intent${pendingCount !== 1 ? 's' : ''})`}
            </button>
            <p className="hint">
              Submits all pending intents to Gateway for on-chain batch settlement on Arc
            </p>

            {lastSettlement && (
              <div className="settlement-result">
                <div className="settlement-stat">
                  <span>{lastSettlement.settled} intents</span>
                  <span>→ 1 batch on Arc</span>
                </div>
                <div className="settlement-stat">
                  <span>Total settled</span>
                  <span className="amount">{lastSettlement.totalAmount} USDC</span>
                </div>
              </div>
            )}
          </div>

          <button
            className="secondary"
            onClick={() => {
              setAddress(null);
              setBalance(null);
              setIntents([]);
              setLastSettlement(null);
            }}
          >
            Create New Wallet
          </button>
        </>
      )}

      {success && <p className="success">{success}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default App;
