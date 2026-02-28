import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"
import { extractUserWallet } from "@/lib/server/auth"

export const runtime = "nodejs"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params

    const result = await extractUserWallet(req)
    if (result instanceof NextResponse) return result
    const { wallet } = result

    // Verify ownership
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, wallet_address")
      .eq("id", merchantId)
      .single()

    if (
      !merchant ||
      merchant.wallet_address.toLowerCase() !== wallet.toLowerCase()
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.callback_url === "string")
      updates.callback_url = body.callback_url || null
    if (typeof body.name === "string" && body.name.trim())
      updates.name = body.name.trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("merchants")
      .update(updates)
      .eq("id", merchantId)
      .select("id, name, callback_url")
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to update merchant", details: message },
      { status: 500 }
    )
  }
}
