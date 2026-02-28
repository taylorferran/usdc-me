import { NextResponse } from "next/server"
import { getFacilitator } from "@/lib/server/gateway"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST() {
  try {
    // Fetch all pending transactions (both send and merchant_payment)
    const { data: pending, error } = await supabaseAdmin
      .from("transactions")
      .select("id, type, from_address, to_address, amount, intent_id, payload, accepted")
      .in("type", ["send", "merchant_payment"])
      .eq("status", "pending")

    if (error) throw error

    console.log("[settle] query returned", pending?.length ?? 0, "rows")
    pending?.forEach((r) =>
      console.log("[settle] row", r.id, "type:", r.type, "payload null?", r.payload == null, "accepted null?", r.accepted == null)
    )

    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: "No pending intents to settle", settled: 0, failed: 0, totalAmount: 0, results: [] })
    }

    const facilitator = getFacilitator()
    const settlementId = crypto.randomUUID()
    const results: Array<{ intentId: string; success: boolean; transaction?: string; error?: string }> = []
    let totalAmount = 0

    for (const intent of pending) {
      try {
        if (intent.payload == null || intent.accepted == null) {
          const reason = "Missing payload — transaction cannot be settled"
          console.warn("[settle] skipping", intent.id, "—", reason)
          results.push({ intentId: intent.id, success: false, error: reason })
          await supabaseAdmin
            .from("transactions")
            .update({ status: "failed", error_reason: reason })
            .eq("id", intent.id)
          continue
        }

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
          const reason = settlement.errorReason ?? "Settlement rejected by facilitator"
          results.push({ intentId: intent.id, success: false, error: reason })

          await supabaseAdmin
            .from("transactions")
            .update({ status: "failed", error_reason: reason })
            .eq("id", intent.id)
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error"
        results.push({ intentId: intent.id, success: false, error: reason })

        await supabaseAdmin
          .from("transactions")
          .update({ status: "failed", error_reason: reason })
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
