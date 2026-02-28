import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"
import { extractUserWallet } from "@/lib/server/auth"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const result = await extractUserWallet(req)
    if (result instanceof NextResponse) return result
    const { wallet } = result

    const { data: merchants, error } = await supabaseAdmin
      .from("merchants")
      .select("id, name, email, wallet_address, callback_url, created_at")
      .eq("wallet_address", wallet)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ merchants: merchants ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch merchants", details: message },
      { status: 500 }
    )
  }
}
