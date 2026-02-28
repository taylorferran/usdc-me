import { useState } from 'react';
import type { Product } from './types';
import ProductGrid from './components/ProductGrid';
import Checkout from './components/Checkout';
import Confirmation from './components/Confirmation';
import './index.css';

type View = 'shop' | 'checkout' | 'confirmation';

export default function App() {
  const [view, setView] = useState<View>('shop');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    setView('checkout');
  };

  const handlePaid = (paymentId: string) => {
    setLastPaymentId(paymentId);
    setView('confirmation');
  };

  const handleBackToShop = () => {
    setSelectedProduct(null);
    setLastPaymentId(null);
    setView('shop');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={handleBackToShop} style={{ cursor: 'pointer' }}>
          Demo Shop
        </h1>
        <span className="badge">Powered by USDC-ME</span>
      </header>

      <main className="app-main">
        {view === 'shop' && <ProductGrid onSelect={handleSelect} />}

        {view === 'checkout' && selectedProduct && (
          <Checkout
            product={selectedProduct}
            onBack={handleBackToShop}
            onPaid={handlePaid}
          />
        )}

        {view === 'confirmation' && selectedProduct && (
          <Confirmation
            product={selectedProduct}
            paymentId={lastPaymentId!}
            onBackToShop={handleBackToShop}
          />
        )}
      </main>
    </div>
  );
}
