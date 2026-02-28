import { supabase } from "@/lib/supabase"

// Empty string = same origin (Next.js API routes).
// Override with NEXT_PUBLIC_API_URL if the backend is a separate service.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ""

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.details ?? data.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  address?: string
  wallet: { balance: string }
  gateway: { total: string; available: string }
}

export interface UserResponse {
  handle: string
  address: string
}

export interface PayResponse {
  status: string
  intentId: string
  amount: string
  new_balance?: string
}

export interface Intent {
  id: string
  from: string
  to: string
  amount: string
  payer: string
  timestamp: string
  status: "pending" | "settled" | "failed"
  transaction?: string
}

export interface SettleResponse {
  settlementId: string
  settled: number
  failed: number
  totalAmount: number
  results: Array<{
    intentId: string
    success: boolean
    transaction?: string
    error?: string
  }>
}

export interface WithdrawResponse {
  status: string
  txHash: string
  amount: string
  sourceChain: string
  destinationChain: string
  recipient: string
}

// ─── User ─────────────────────────────────────────────────────────────────────

export const getUser = (handle: string) =>
  apiFetch<UserResponse>(`/api/user/${handle}`)

// ─── Balance ──────────────────────────────────────────────────────────────────

export const getBalance = (address: string) =>
  apiFetch<BalanceResponse>(`/api/wallet/${address}/balance`)

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface SendSignedPayload {
  from: string
  to: string
  amount: string
  signedPayload: {
    x402Version: number
    payload: {
      authorization: {
        from: string
        to: string
        value: string
        validAfter: string
        validBefore: string
        nonce: string
      }
      signature: string
    }
  }
}

export const sendSigned = (data: SendSignedPayload) =>
  apiFetch<PayResponse>("/api/send-signed", {
    method: "POST",
    body: JSON.stringify(data),
  })

// ─── Intents ──────────────────────────────────────────────────────────────────

export const getIntents = (address?: string) =>
  apiFetch<Intent[]>(address ? `/api/intents?address=${address}` : "/api/intents")

// ─── Settlement ───────────────────────────────────────────────────────────────

export const settle = () =>
  apiFetch<SettleResponse>("/api/settle", { method: "POST" })

// ─── Withdraw ─────────────────────────────────────────────────────────────────

export const withdraw = (data: {
  address: string
  amount: string
  chain: string
  privateKey: string
  recipient?: string
}) =>
  apiFetch<WithdrawResponse>(`/api/wallet/${data.address}/withdraw`, {
    method: "POST",
    body: JSON.stringify({
      amount: data.amount,
      chain: data.chain,
      privateKey: data.privateKey,
      ...(data.recipient ? { recipient: data.recipient } : {}),
    }),
  })

// ─── Merchant ────────────────────────────────────────────────────────────────

export interface MerchantResponse {
  merchant_id: string
  api_key: string
  name: string
  wallet_address: string
}

export interface PaymentDetails {
  payment_id: string
  merchant_name: string
  merchant_wallet: string
  amount: string
  description: string | null
  status: "pending" | "paid" | "expired" | "failed"
  redirect_url: string | null
  expires_at: string
}

export const registerMerchant = (data: {
  name: string
  email: string
  wallet_address: string
  callback_url?: string
}) =>
  apiFetch<MerchantResponse>("/api/merchants/register", {
    method: "POST",
    body: JSON.stringify(data),
  })

export const getPaymentDetails = (paymentId: string) =>
  apiFetch<PaymentDetails>(`/api/payments/${paymentId}`)

export const payPaymentRequest = (
  paymentId: string,
  from: string,
  signedPayload: unknown
) =>
  apiFetch<{ status: string; intentId: string; amount: string }>(
    `/api/payments/${paymentId}/pay`,
    {
      method: "POST",
      body: JSON.stringify({ from, signedPayload }),
    }
  )

// ─── Merchant Dashboard ─────────────────────────────────────────────────────

export interface MerchantAccount {
  id: string
  name: string
  email: string
  wallet_address: string
  callback_url: string | null
  created_at: string
}

export interface MerchantPayment {
  id: string
  amount: string
  description: string | null
  status: "pending" | "paid" | "expired"
  payer_address: string | null
  intent_id: string | null
  expires_at: string
  created_at: string
}

export interface PaymentSummary {
  total_payments: number
  total_paid: number
  total_pending: number
  total_expired: number
  revenue: string
  pending_amount: string
}

export interface MerchantPaymentsResponse {
  payments: MerchantPayment[]
  summary: PaymentSummary
}

export const getMyMerchants = () =>
  apiFetch<{ merchants: MerchantAccount[] }>("/api/merchants/me")

export const getMerchantPayments = (
  merchantId: string,
  options?: { status?: string }
) => {
  const params = new URLSearchParams()
  if (options?.status) params.set("status", options.status)
  const qs = params.toString()
  return apiFetch<MerchantPaymentsResponse>(
    `/api/merchants/${merchantId}/payments${qs ? `?${qs}` : ""}`
  )
}

export const updateMerchant = (
  merchantId: string,
  data: { name?: string; callback_url?: string }
) =>
  apiFetch<{ id: string; name: string; callback_url: string | null }>(
    `/api/merchants/${merchantId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  )
