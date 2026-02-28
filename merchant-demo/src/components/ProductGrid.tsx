import { PRODUCTS, type Product } from '../types';

interface Props {
  onSelect: (product: Product) => void;
}

export default function ProductGrid({ onSelect }: Props) {
  return (
    <div className="products">
      {PRODUCTS.map((p) => (
        <div key={p.id} className="product-card" onClick={() => onSelect(p)}>
          <div className="product-icon">{p.icon}</div>
          <div className="product-name">{p.name}</div>
          <div className="product-desc">{p.description}</div>
          <div className="product-price">${p.price} USDC</div>
        </div>
      ))}
    </div>
  );
}
