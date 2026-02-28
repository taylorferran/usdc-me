import { Routes, Route } from 'react-router-dom';
import App from './App';
import PaymentPage from './pages/PaymentPage';
import MerchantPage from './pages/MerchantPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/pay/:paymentId" element={<PaymentPage />} />
      <Route path="/merchant" element={<MerchantPage />} />
    </Routes>
  );
}
