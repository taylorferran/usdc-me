import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const address = searchParams.get("address")

    let query = supabaseAdmin
      .from("transactions")
      .select("id, from_address, to_address, amount, status, tx_hash, created_at, intent_id, error_reason")
      .in("type", ["send", "merchant_payment"])
      .order("created_at", { ascending: false })
      .limit(100)

    if (address) {
      query = query.or(`from_address.eq.${address},to_address.eq.${address}`)
    }

    const { data, error } = await query

    if (error) throw error

    // Map to the shape the frontend expects
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

    return NextResponse.json(intents)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch intents", details: message },
      { status: 500 }
    )
  }
}
