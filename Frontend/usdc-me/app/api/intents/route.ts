import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

const MAX_LIMIT = 500

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const address = searchParams.get("address")
    const status = searchParams.get("status") // pending | settled | failed
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from("transactions")
      .select("id, from_address, to_address, amount, status, tx_hash, created_at, intent_id, error_reason", {
        count: "exact",
      })
      .in("type", ["send", "merchant_payment"])
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (address) {
      query = query.or(`from_address.eq.${address},to_address.eq.${address}`)
    }

    if (status && ["pending", "settled", "failed"].includes(status)) {
      query = query.eq("status", status)
    }

    const { data, error, count } = await query

    if (error) throw error

    const intents = (data ?? []).map((row) => ({
      id: row.id,
      from: row.from_address,
      to: row.to_address,
      amount: row.amount,
      payer: row.from_address,
      timestamp: row.created_at,
      status: row.status,
      transaction: row.tx_hash ?? undefined,
      errorReason: row.error_reason ?? undefined,
    }))

    return NextResponse.json({
      data: intents,
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch intents", details: message },
      { status: 500 }
    )
  }
}
