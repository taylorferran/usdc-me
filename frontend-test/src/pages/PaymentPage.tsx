import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { signX402Payment } from '../lib/signing';
import { ARC_GATEWAY_WALLET } from '../lib/wallet';

const API_URL = 'http://localhost:3001/api';
const ARC_CHAIN_ID = 5042002;

interface PaymentDetails {
  id: string;
  merchantName: string;
  amount: string;
  description: string | null;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  merchantWallet: string;
  redirectUrl: string | null;
}

export default function PaymentPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';
  const wallet = useWallet();

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // Auth form state (inline login for payment page)
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authHandle, setAuthHandle] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    fetch(`${API_URL}/payments/${paymentId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Payment not found');
        }
        return res.json();
      })
      .then((data) => setPayment(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handleAuth = async () => {
    if (!authEmail || !authPassword) return;
    if (isSignup && !authHandle) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (isSignup) {
        await wallet.signup(authEmail, authPassword, authHandle);
      } else {
        await wallet.login(authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePay = async () => {
    if (!wallet.privateKey || !wallet.address || !payment) return;
    setPaying(true);
    setError(null);
    try {
      const amountAtomic = Math.round(parseFloat(payment.amount) * 1e6).toString();

      const signedPayload = await signX402Payment(
        wallet.privateKey,
        payment.merchantWallet as `0x${string}`,
        amountAtomic,
        ARC_GATEWAY_WALLET,
        ARC_CHAIN_ID,
      );

      const res = await fetch(`${API_URL}/payments/${paymentId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: wallet.address,
          signedPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error);

      setPaid(true);
      setPayment((prev) => prev ? { ...prev, status: 'paid' } : prev);

      // Notify widget opener via postMessage if embedded
      if (isEmbed && window.opener) {
        window.opener.postMessage(
          { type: 'usdcme:payment_success', paymentId, intentId: data.intentId },
          '*',
        );
      }

      // Redirect after short delay if redirect_url set
      if (payment.redirectUrl && !isEmbed) {
        setTimeout(() => {
          window.location.href = payment.redirectUrl!;
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <p className="hint">Loading payment...</p>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!payment) return null;

  // Payment already completed or expired
  if (payment.status === 'paid' || paid) {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <div className="card">
          <h3>Payment Complete</h3>
          <div className="payment-summary">
            <div className="balance-row">
              <span>Amount</span>
              <span className="amount highlight">{payment.amount} USDC</span>
            </div>
            <div className="balance-row">
              <span>Merchant</span>
              <span>{payment.merchantName}</span>
            </div>
          </div>
          <p className="success">Payment successful!</p>
          {payment.redirectUrl && !isEmbed && (
            <p className="hint">Redirecting back to merchant...</p>
          )}
        </div>
      </div>
    );
  }

  if (payment.status === 'expired') {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <div className="card">
          <h3>Payment Expired</h3>
          <p className="hint">This payment request has expired. Please ask the merchant for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>USDC.me</h1>
      <p className="subtitle">Payment Request</p>

      {/* Payment details */}
      <div className="card">
        <h3>{payment.merchantName}</h3>
        {payment.description && <p className="hint">{payment.description}</p>}
        <div className="payment-summary">
          <div className="balance-row">
            <span>Amount Due</span>
            <span className="amount highlight">{payment.amount} USDC</span>
          </div>
        </div>
      </div>

      {/* Not logged in: show inline auth */}
      {!wallet.isUnlocked ? (
        <div className="card">
          <h3>{isSignup ? 'Sign Up to Pay' : 'Log In to Pay'}</h3>
          <p className="hint">
            {isSignup
              ? 'Create a USDC.me wallet to complete this payment.'
              : 'Log in to your USDC.me wallet to complete this payment.'}
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
          <button
            onClick={handleAuth}
            disabled={authLoading || !authEmail || !authPassword || (isSignup && !authHandle)}
          >
            {authLoading
              ? (isSignup ? 'Creating wallet...' : 'Decrypting...')
              : (isSignup ? 'Sign Up' : 'Log In')}
          </button>
          <button
            className="secondary"
            onClick={() => { setIsSignup(!isSignup); setAuthError(null); }}
          >
            {isSignup ? 'Already have an account? Log in' : 'Need an account? Sign up'}
          </button>
          {authError && <p className="error">{authError}</p>}
        </div>
      ) : (
        /* Logged in: show confirm payment */
        <div className="card">
          <p className="hint">
            Signed in as @{wallet.handle || wallet.email}
          </p>
          <p className="hint" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
            Wallet: {wallet.address}
          </p>
          <button
            className="settle-btn"
            onClick={handlePay}
            disabled={paying}
          >
            {paying ? 'Signing payment...' : `Pay ${payment.amount} USDC`}
          </button>
          <p className="hint">
            Signs an x402 spend intent in your browser (instant, gasless)
          </p>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
