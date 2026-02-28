import type { Product } from '../types';

interface Props {
  product: Product;
  paymentId: string;
  onBackToShop: () => void;
}

export default function Confirmation({ product, paymentId, onBackToShop }: Props) {
  return (
    <div className="confirmation">
      <div className="success-icon">&#10003;</div>
      <h2>Payment Received!</h2>
      <p className="sub">Your order is confirmed</p>

      <div className="receipt">
        <div className="receipt-row">
          <span className="label">Item</span>
          <span className="value">{product.name}</span>
        </div>
        <div className="receipt-row">
          <span className="label">Amount</span>
          <span className="value">${product.price} USDC</span>
        </div>
        <div className="receipt-row">
          <span className="label">Payment ID</span>
          <span className="value" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
            {paymentId}
          </span>
        </div>
        <div className="receipt-row">
          <span className="label">Status</span>
          <span className="value" style={{ color: '#4ade80' }}>Paid</span>
        </div>
      </div>

      <button className="shop-btn" onClick={onBackToShop}>
        Continue Shopping
      </button>
    </div>
  );
}
