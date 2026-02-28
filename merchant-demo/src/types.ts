export interface Product {
  id: number;
  icon: string;
  name: string;
  description: string;
  price: string;
}

export const PRODUCTS: Product[] = [
  { id: 1, icon: '\u26A1', name: 'API Access', description: 'Premium API — 1 month', price: '0.1' },
  { id: 2, icon: '\uD83C\uDFA8', name: 'Pro Theme', description: 'Custom UI theme pack', price: '0.5' },
  { id: 3, icon: '\uD83D\uDE80', name: 'Cloud Deploy', description: '1-click deploy credits', price: '2' },
  { id: 4, icon: '\uD83D\uDD12', name: 'SSL Certificate', description: 'Wildcard SSL — 1 year', price: '5' },
];
