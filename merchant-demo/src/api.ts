import { API_URL, MERCHANT_API_KEY } from './config';

export interface PaymentResponse {
  payment_id: string;
  payment_url: string;
  amount: string;
  status: string;
  expires_at: string;
}

export interface PaymentStatus {
  payment_id: string;
  merchant_name: string;
  amount: string;
  description: string | null;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  redirect_url: string | null;
}

export async function createPayment(amount: string, description: string) {
  const res = await fetch(`${API_URL}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MERCHANT_API_KEY,
    },
    body: JSON.stringify({ amount, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.details || 'Failed to create payment');
  return data as PaymentResponse;
}

export async function getPaymentStatus(paymentId: string) {
  const res = await fetch(`${API_URL}/payments/${paymentId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch status');
  return data as PaymentStatus;
}
