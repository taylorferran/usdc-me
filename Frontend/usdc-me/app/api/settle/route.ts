import { NextResponse } from "next/server"
import { getFacilitator } from "@/lib/server/gateway"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST() {
  try {
    // Fetch all pending send transactions that have a stored payload
    const { data: pending, error } = await supabaseAdmin
      .from("transactions")
      .select("id, from_address, to_address, amount, intent_id, payload, accepted")
      .eq("type", "send")
      .eq("status", "pending")
      .not("payload", "is", null)

    if (error) throw error
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: "No pending intents to settle", settled: 0, failed: 0, totalAmount: 0, results: [] })
    }

    const facilitator = getFacilitator()
    const settlementId = crypto.randomUUID()
    const results: Array<{ intentId: string; success: boolean; transaction?: string; error?: string }> = []
    let totalAmount = 0

    for (const intent of pending) {
      try {
        const settlement = await facilitator.settle(intent.payload, intent.accepted)

        if (settlement.success) {
          totalAmount += parseFloat(intent.amount)
          results.push({ intentId: intent.id, success: true, transaction: settlement.transaction })

          await supabaseAdmin
            .from("transactions")
            .update({
              status: "settled",
              tx_hash: settlement.transaction,
              settlement_id: settlementId,
            })
            .eq("id", intent.id)
        } else {
          results.push({ intentId: intent.id, success: false, error: settlement.errorReason })

          await supabaseAdmin
            .from("transactions")
            .update({ status: "failed" })
            .eq("id", intent.id)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        results.push({ intentId: intent.id, success: false, error: msg })

        await supabaseAdmin
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", intent.id)
      }
    }

    const succeeded = results.filter((r) => r.success).length

    return NextResponse.json({
      settlementId,
      settled: succeeded,
      failed: pending.length - succeeded,
      totalAmount,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Settlement failed", details: message },
      { status: 500 }
    )
  }
}
