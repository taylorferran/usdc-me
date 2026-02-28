import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

const API_URL = 'http://localhost:3001/api';
const FRONTEND_URL = 'http://localhost:5173';

interface MerchantInfo {
  merchantId: string;
  apiKey: string;
  name: string;
}

export default function MerchantPage() {
  const wallet = useWallet();

  const [storeName, setStoreName] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!wallet.isUnlocked) {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <p className="subtitle">Merchant Setup</p>
        <div className="card">
          <p className="hint">Please <Link to="/">log in</Link> to set up your merchant account.</p>
        </div>
      </div>
    );
  }

  const handleRegister = async () => {
    if (!storeName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/merchants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: storeName,
          email: wallet.email,
          walletAddress: wallet.address,
          ...(callbackUrl && { callbackUrl }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Registration failed');
      setMerchant({ merchantId: data.merchantId, apiKey: data.apiKey, name: storeName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const widgetSnippet = merchant
    ? `<div id="usdcme-pay"
     data-payment-id="YOUR_PAYMENT_ID"
     data-base-url="${FRONTEND_URL}">
</div>
<script src="${FRONTEND_URL}/widget.js"><\/script>`
    : '';

  const createPaymentSnippet = merchant
    ? `fetch("${API_URL}/payments/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${merchant.apiKey}"
  },
  body: JSON.stringify({
    amount: "10",
    description: "Your product description",
    redirectUrl: "https://your-site.com/thank-you"
  })
})
.then(res => res.json())
.then(data => {
  // data.paymentId — use in widget or QR code
  // data.paymentUrl — direct link for customer
  console.log(data);
});`
    : '';

  // Already registered
  if (merchant) {
    return (
      <div className="container">
        <h1>USDC.me</h1>
        <p className="subtitle">Merchant Setup</p>

        <div className="card">
          <h3>Registered!</h3>
          <div className="balances">
            <div className="balance-row">
              <span>Store Name</span>
              <span>{merchant.name}</span>
            </div>
            <div className="balance-row">
              <span>Wallet</span>
              <span style={{ fontSize: '0.75rem' }}>{wallet.address?.slice(0, 12)}...</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Your API Key</h3>
          <p className="hint">Keep this secret. Use it server-side to create payment requests.</p>
          <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 12, wordBreak: 'break-all', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            {merchant.apiKey}
          </div>
          <button onClick={() => copyToClipboard(merchant.apiKey, 'apiKey')}>
            {copied === 'apiKey' ? 'Copied!' : 'Copy API Key'}
          </button>
        </div>

        <div className="card">
          <h3>1. Create a Payment Request</h3>
          <p className="hint">Call this from your server when a customer checks out.</p>
          <pre style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, overflow: 'auto', fontSize: '0.7rem', lineHeight: 1.5, color: '#a5b4fc' }}>
            {createPaymentSnippet}
          </pre>
          <button className="secondary" onClick={() => copyToClipboard(createPaymentSnippet, 'createPayment')}>
            {copied === 'createPayment' ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        <div className="card">
          <h3>2. Add the Widget to Your Site</h3>
          <p className="hint">
            Paste this HTML where you want the "Pay with USDC.me" button.
            Replace YOUR_PAYMENT_ID with the paymentId from step 1.
          </p>
          <pre style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, overflow: 'auto', fontSize: '0.7rem', lineHeight: 1.5, color: '#a5b4fc' }}>
            {widgetSnippet}
          </pre>
          <button className="secondary" onClick={() => copyToClipboard(widgetSnippet, 'widget')}>
            {copied === 'widget' ? 'Copied!' : 'Copy Widget Code'}
          </button>
        </div>

        <div className="card">
          <h3>3. Listen for Payment</h3>
          <p className="hint">The widget fires a DOM event when the customer pays:</p>
          <pre style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, overflow: 'auto', fontSize: '0.7rem', lineHeight: 1.5, color: '#a5b4fc' }}>
{`document.addEventListener("usdcme:payment", (e) => {
  console.log("Paid!", e.detail);
  // { paymentId, intentId, status: "paid" }
});`}
          </pre>
          <p className="hint" style={{ marginTop: 8 }}>
            Or poll <code style={{ color: '#a5b4fc' }}>GET /api/payments/:paymentId</code> for status changes.
            {merchant && callbackUrl && <> Webhooks will also POST to <strong>{callbackUrl}</strong>.</>}
          </p>
        </div>

        <div className="card">
          <h3>Payment Page URL</h3>
          <p className="hint">Direct customers to this URL pattern:</p>
          <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, fontSize: '0.8rem', fontFamily: 'monospace', color: '#a5b4fc' }}>
            {FRONTEND_URL}/pay/YOUR_PAYMENT_ID
          </div>
        </div>

        <Link to="/">
          <button className="secondary" style={{ marginTop: 0 }}>Back to Wallet</button>
        </Link>
      </div>
    );
  }

  // Registration form
  return (
    <div className="container">
      <h1>USDC.me</h1>
      <p className="subtitle">Merchant Setup</p>

      <div className="card">
        <h3>Register as a Merchant</h3>
        <p className="hint">
          Accept USDC payments on your site. Payments are signed client-side via x402 — instant and gasless.
        </p>

        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>Store Name</label>
        <input
          type="text"
          placeholder="My Awesome Store"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
        />

        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>Receiving Wallet</label>
        <div style={{ background: '#0f0f1a', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: '0.8rem', color: '#888', wordBreak: 'break-all' }}>
          {wallet.address}
        </div>

        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>Webhook Callback URL (optional)</label>
        <input
          type="text"
          placeholder="https://your-site.com/webhooks/usdcme"
          value={callbackUrl}
          onChange={(e) => setCallbackUrl(e.target.value)}
        />

        <button
          onClick={handleRegister}
          disabled={loading || !storeName}
        >
          {loading ? 'Registering...' : 'Register as Merchant'}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      <Link to="/">
        <button className="secondary">Back to Wallet</button>
      </Link>
    </div>
  );
}
