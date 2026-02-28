import { supabase } from "@/lib/supabase"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

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
  status: "pending" | "settled"
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

export const getIntents = () => apiFetch<Intent[]>("/api/intents")

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
