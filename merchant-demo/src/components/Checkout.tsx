import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import type { Product } from '../types';
import { createPayment, getPaymentStatus } from '../api';
import { FRONTEND_URL } from '../config';

interface Props {
  product: Product;
  onBack: () => void;
  onPaid: (paymentId: string) => void;
}

type Status = 'idle' | 'creating' | 'waiting' | 'paid' | 'expired' | 'error';

export default function Checkout({ product, onBack, onPaid }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<number | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Render QR when paymentUrl is set
  useEffect(() => {
    if (paymentUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, paymentUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#e8e8f0', light: '#13132a' },
      });
    }
  }, [paymentUrl]);

  // Load widget when paymentId is set
  useEffect(() => {
    if (!paymentId || !widgetRef.current) return;

    widgetRef.current.innerHTML = '';
    const container = document.createElement('div');
    container.id = 'usdcme-pay';
    container.setAttribute('data-payment-id', paymentId);
    container.setAttribute('data-base-url', FRONTEND_URL);
    widgetRef.current.appendChild(container);

    const oldScript = document.getElementById('usdcme-widget-script');
    if (oldScript) oldScript.remove();
    const script = document.createElement('script');
    script.id = 'usdcme-widget-script';
    script.src = `${FRONTEND_URL}/widget.js`;
    document.body.appendChild(script);
  }, [paymentId]);

  // Listen for widget payment events
  useEffect(() => {
    const handler = () => {
      cleanup();
      setStatus('paid');
      if (paymentId) {
        setTimeout(() => onPaid(paymentId), 1200);
      }
    };
    document.addEventListener('usdcme:payment', handler);
    return () => document.removeEventListener('usdcme:payment', handler);
  }, [paymentId, onPaid, cleanup]);

  const startPayment = async () => {
    setStatus('creating');
    setError(null);
    try {
      const res = await createPayment(
        product.price,
        `${product.name} — ${product.description}`,
      );
      const pid = res.payment_id;
      const url = `${FRONTEND_URL}/pay/${pid}`;
      setPaymentId(pid);
      setPaymentUrl(url);
      setStatus('waiting');

      // Start polling
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await getPaymentStatus(pid);
          if (s.status === 'paid') {
            cleanup();
            setStatus('paid');
            setTimeout(() => onPaid(pid), 1200);
          } else if (s.status === 'expired') {
            cleanup();
            setStatus('expired');
          }
        } catch {
          // silent
        }
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setStatus('error');
    }
  };

  return (
    <div className="checkout">
      {/* Product summary */}
      <div className="checkout-header">
        <div className="checkout-icon">{product.icon}</div>
        <div className="checkout-info">
          <h3>{product.name}</h3>
          <p className="desc">{product.description}</p>
        </div>
      </div>

      <div className="checkout-total">
        <span>Total</span>
        <span className="price">${product.price} USDC</span>
      </div>

      {/* Pay button */}
      {status === 'idle' && (
        <button className="pay-btn" onClick={startPayment}>
          Pay with USDC.me
        </button>
      )}

      {status === 'creating' && (
        <button className="pay-btn" disabled>
          Creating payment...
        </button>
      )}

      {status === 'error' && (
        <>
          <div className="error-msg">{error}</div>
          <button className="pay-btn" onClick={startPayment}>
            Try Again
          </button>
        </>
      )}

      {/* Payment section */}
      {(status === 'waiting' || status === 'paid') && paymentUrl && (
        <div className="payment-section">
          <h4>Complete your payment</h4>

          <div className="qr-wrapper">
            <canvas ref={canvasRef} />
            <div className="pay-link">
              <a href={paymentUrl} target="_blank" rel="noreferrer">
                {paymentUrl}
              </a>
            </div>
          </div>

          <div className="divider">or</div>

          <div className="widget-area" ref={widgetRef} />

          <button
            className="open-link-btn"
            onClick={() => window.open(paymentUrl, '_blank')}
          >
            Open Payment Page
          </button>

          {/* Status indicator */}
          <div className={`status-bar ${status === 'paid' ? 'success' : 'waiting'}`}>
            <div className="status-dot" />
            <span>
              {status === 'paid' ? 'Payment received!' : 'Waiting for payment...'}
            </span>
          </div>
        </div>
      )}

      {status === 'expired' && (
        <div className="status-bar expired">
          <div className="status-dot" />
          <span>Payment expired. Please try again.</span>
        </div>
      )}

      <button className="back-link" onClick={onBack}>
        Back to shop
      </button>
    </div>
  );
}
