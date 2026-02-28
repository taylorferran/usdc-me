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
  txHash: string
  status: string
}

// ─── Wallet creation (called during registration) ─────────────────────────────

export const createWallet = () =>
  apiFetch<{ address: string }>("/api/wallet/create", { method: "POST" })

// ─── User ─────────────────────────────────────────────────────────────────────

export const getUser = (handle: string) =>
  apiFetch<UserResponse>(`/api/user/${handle}`)

// ─── Balance ──────────────────────────────────────────────────────────────────

export const getBalance = () => apiFetch<BalanceResponse>("/api/wallet/balance")

// ─── Payments ─────────────────────────────────────────────────────────────────

export const pay = (handle: string, amount: string) =>
  apiFetch<PayResponse>(`/api/pay/${handle}`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  })

// ─── Intents ──────────────────────────────────────────────────────────────────

export const getIntents = () => apiFetch<Intent[]>("/api/intents")

// ─── Settlement ───────────────────────────────────────────────────────────────

export const settle = () =>
  apiFetch<SettleResponse>("/api/settle", { method: "POST" })

// ─── Future endpoints (shells — wired when backend adds them) ─────────────────

export const withdraw = (data: {
  amount: string
  chain: string
  address: string
}) =>
  apiFetch<WithdrawResponse>("/api/withdraw", {
    method: "POST",
    body: JSON.stringify(data),
  })

export const addFunds = () =>
  apiFetch<{ wallet: { balance: string } }>("/api/fund", { method: "POST" })
