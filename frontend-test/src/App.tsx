import { useState } from 'react';
import './App.css';
import { useWallet } from './context/WalletContext';
import { signX402Payment, deposit as clientDeposit } from './lib/signing';
import { ARC_GATEWAY_WALLET } from './lib/wallet';

const API_URL = 'http://localhost:3001/api';
const ARC_CHAIN_ID = 5042002;

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
  const wallet = useWallet();

  // Auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authHandle, setAuthHandle] = useState('');
  const [authRecoveryPassword, setAuthRecoveryPassword] = useState('');
  const [isSignup, setIsSignup] = useState(true);

  // Recovery mode state
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // App state
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

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawChain, setWithdrawChain] = useState('arcTestnet');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');

  const handleAuth = async () => {
    if (!authEmail || !authPassword) return;
    if (isSignup && !authHandle) return;
    if (isSignup && !authRecoveryPassword) return;
    setLoading('auth');
    setError(null);
    try {
      if (isSignup) {
        if (authRecoveryPassword === authPassword) {
          throw new Error('Recovery password must be different from your login password.');
        }
        if (authRecoveryPassword.length < 8) {
          throw new Error('Recovery password must be at least 8 characters.');
        }
        await wallet.signup(authEmail, authPassword, authHandle, authRecoveryPassword);
      } else {
        await wallet.login(authEmail, authPassword);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auth failed';
      if (msg === 'NEEDS_RECOVERY') {
        setError('Password changed — enter your recovery password to restore your wallet.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleRecover = async () => {
    const email = wallet.needsRecovery ? (wallet.email || '') : recoveryEmail;
    if (!email || !recoveryInput || !newPasswordInput) return;
    if (newPasswordInput.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setLoading('recover');
    setError(null);
    try {
      if (wallet.needsRecovery) {
        // Already authenticated — use direct Supabase recovery
        await wallet.recoverWithPassword(recoveryInput, newPasswordInput);
      } else {
        // Not authenticated — use backend recovery endpoints
        await wallet.recover(email, recoveryInput, newPasswordInput);
      }
      setSuccess('Wallet recovered! Your password has been updated.');
      setRecoveryInput('');
      setNewPasswordInput('');
      setRecoveryEmail('');
      setShowRecoveryForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setLoading(null);
    }
  };

  const checkBalance = async () => {
    if (!wallet.address) return;
    setLoading('balance');
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wallet/${wallet.address}/balance`);
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

  const handleDeposit = async () => {
    if (!wallet.privateKey || !depositAmount) return;
    setLoading('deposit');
    setError(null);
    setSuccess(null);
    try {
      const result = await clientDeposit(wallet.privateKey, depositAmount);
      setSuccess(`Deposited ${depositAmount} USDC to Gateway (tx: ${result.depositTxHash})`);
      setDepositAmount('');
      checkBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setLoading(null);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet.privateKey || !wallet.address || !withdrawAmount) return;
    setLoading('withdraw');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/wallet/${wallet.address}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: withdrawAmount,
          chain: withdrawChain,
          privateKey: wallet.privateKey,
          ...(withdrawRecipient && { recipient: withdrawRecipient }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);
      setSuccess(`Withdrew ${data.amount} USDC to ${data.recipient.slice(0, 10)}... on ${data.destinationChain} (tx: ${data.txHash})`);
      setWithdrawAmount('');
      setWithdrawRecipient('');
      checkBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdraw failed');
    } finally {
      setLoading(null);
    }
  };

  const send = async () => {
    if (!wallet.privateKey || !wallet.address || !sendTo || !sendAmount) return;
    setLoading('send');
    setError(null);
    setSuccess(null);
    try {
      const amountAtomic = Math.round(parseFloat(sendAmount) * 1e6).toString();

      // Sign the x402 payload in the browser
      const signedPayload = await signX402Payment(
        wallet.privateKey,
        sendTo as `0x${string}`,
        amountAtomic,
        ARC_GATEWAY_WALLET,
        ARC_CHAIN_ID,
      );

      // Send pre-signed payload to backend for verification
      const res = await fetch(`${API_URL}/send-signed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: wallet.address,
          to: sendTo,
          amount: sendAmount,
          signedPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error);
      setSuccess(`Sent ${sendAmount} USDC to ${sendTo.slice(0, 10)}... (intent queued)`);
      setSendTo('');
      setSendAmount('');
      checkBalance();
      fetchIntents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
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

  // ── Recovery mode: key decryption failed after password reset ──
  if (wallet.needsRecovery) {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <p className="subtitle">Wallet Recovery</p>

        <div className="card">
          <h3>Recover Your Wallet</h3>
          <p className="hint">
            Your login password has changed and your wallet key needs to be re-encrypted.
            Enter the recovery password you set during registration.
          </p>
          <input
            type="password"
            placeholder="Recovery password"
            value={recoveryInput}
            onChange={(e) => setRecoveryInput(e.target.value)}
          />
          <input
            type="password"
            placeholder="New password (will become your login password)"
            value={newPasswordInput}
            onChange={(e) => setNewPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
          />
          <button
            onClick={handleRecover}
            disabled={loading === 'recover' || !recoveryInput || !newPasswordInput}
          >
            {loading === 'recover' ? 'Recovering...' : 'Recover Wallet'}
          </button>
          <button className="secondary" onClick={wallet.logout}>
            Cancel &amp; Log Out
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </div>
    );
  }

  // ── Not logged in: show auth form or recovery form ──
  if (!wallet.isUnlocked) {
    // Show standalone recovery form (forgot password from login screen)
    if (showRecoveryForm) {
      return (
        <div className="container">
          <h1>USDC.me</h1>
          <p className="subtitle">Wallet Recovery</p>

          <div className="card">
            <h3>Recover Your Wallet</h3>
            <p className="hint">
              Enter the email you registered with and the recovery password you saved during signup.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Recovery password"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
            />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
            />
            <button
              onClick={handleRecover}
              disabled={loading === 'recover' || !recoveryEmail || !recoveryInput || !newPasswordInput}
            >
              {loading === 'recover' ? 'Recovering...' : 'Recover Wallet'}
            </button>
            <button
              className="secondary"
              onClick={() => { setShowRecoveryForm(false); setError(null); setSuccess(null); }}
            >
              Back to Login
            </button>
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </div>
      );
    }

    return (
      <div className="container">
        <h1>USDC.me</h1>
        <p className="subtitle">Universal USDC Payments on Arc via x402</p>

        <div className="card">
          <h3>{isSignup ? 'Sign Up' : 'Log In'}</h3>
          <p className="hint">
            {isSignup
              ? 'Creates a wallet encrypted with your password. We never see your private key.'
              : 'Decrypts your wallet locally in the browser.'}
          </p>
          {isSignup && (
            <input
              type="text"
              placeholder="Username (e.g. alice)"
              value={authHandle}
              onChange={(e) => setAuthHandle(e.target.value)}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          />
          {isSignup && (
            <>
              <input
                type="password"
                placeholder="Recovery password (write this down!)"
                value={authRecoveryPassword}
                onChange={(e) => setAuthRecoveryPassword(e.target.value)}
              />
              <p className="hint" style={{ marginTop: '-8px', fontSize: '0.8em' }}>
                If you forget your login password, this is your only way to recover your wallet. Store it safely.
              </p>
            </>
          )}
          <button onClick={handleAuth} disabled={loading === 'auth' || !authEmail || !authPassword || (isSignup && (!authHandle || !authRecoveryPassword))}>
            {loading === 'auth'
              ? (isSignup ? 'Creating wallet...' : 'Decrypting...')
              : (isSignup ? 'Sign Up' : 'Log In')}
          </button>
          {!isSignup && (
            <button
              className="secondary"
              onClick={() => { setShowRecoveryForm(true); setError(null); }}
            >
              Forgot password? Recover with recovery password
            </button>
          )}
          <button
            className="secondary"
            onClick={() => { setIsSignup(!isSignup); setError(null); }}
          >
            {isSignup ? 'Already have an account? Log in' : 'Need an account? Sign up'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // ── Logged in: show wallet + payment UI ──
  return (
    <div className="container">
      <h1>USDC.me</h1>
      <p className="subtitle">Signed in as @{wallet.handle || wallet.email}</p>

      {/* Wallet Info */}
      <div className="card">
        <div className="wallet-info">
          <label>Your Wallet Address</label>
          <div className="address">{wallet.address}</div>
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
          Move USDC from your wallet into Gateway (required before sending via x402).
          Signed locally in your browser.
        </p>
        <div className="form-row">
          <input
            type="text"
            placeholder="Amount (e.g. 5)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <button onClick={handleDeposit} disabled={loading === 'deposit' || !depositAmount}>
            {loading === 'deposit' ? 'Depositing...' : 'Deposit'}
          </button>
        </div>
      </div>

      {/* Withdraw from Gateway */}
      <div className="card">
        <h3>Withdraw from Gateway</h3>
        <p className="hint">
          Move USDC from Gateway to any address on any supported chain.
          Leave recipient blank to withdraw to your own wallet.
        </p>
        <input
          type="text"
          placeholder="Recipient address (0x...) — blank = your wallet"
          value={withdrawRecipient}
          onChange={(e) => setWithdrawRecipient(e.target.value)}
        />
        <select
          value={withdrawChain}
          onChange={(e) => setWithdrawChain(e.target.value)}
        >
          <option value="arcTestnet">Arc Testnet</option>
          <option value="baseSepolia">Base Sepolia</option>
          <option value="sepolia">Ethereum Sepolia</option>
          <option value="arbitrumSepolia">Arbitrum Sepolia</option>
          <option value="optimismSepolia">Optimism Sepolia</option>
          <option value="avalancheFuji">Avalanche Fuji</option>
        </select>
        <div className="form-row">
          <input
            type="text"
            placeholder="Amount (e.g. 5)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <button onClick={handleWithdraw} disabled={loading === 'withdraw' || !withdrawAmount}>
            {loading === 'withdraw' ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      </div>

      {/* Send via x402 */}
      <div className="card">
        <h3>Send USDC (x402)</h3>
        <p className="hint">
          Signs an x402 spend intent in your browser (instant, gasless)
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
            {loading === 'send' ? 'Signing...' : 'Send'}
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

      <button className="secondary" onClick={wallet.logout}>
        Log Out
      </button>

      {success && <p className="success">{success}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default App;
