import { NextResponse } from "next/server"
import { getFacilitator } from "@/lib/server/gateway"
import { supabaseAdmin } from "@/lib/server/supabase"
import { sendPushToAddress } from "@/lib/server/push"
import { formatUsdc } from "@/lib/format"

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

    const settledSenders: string[] = []
    const settledRecipients: string[] = []

    const BATCH_SIZE = 50

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const chunk = pending.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        chunk.map(async (intent) => {
          try {
            if (intent.payload == null || intent.accepted == null) {
              const reason = "Missing payload — transaction cannot be settled"
              console.warn("[settle] skipping", intent.id, "—", reason)
              await supabaseAdmin
                .from("transactions")
                .update({ status: "failed", error_reason: reason })
                .eq("id", intent.id)
              return { intentId: intent.id, success: false as const, error: reason }
            }

            const settlement = await facilitator.settle(intent.payload, intent.accepted)

            if (settlement.success) {
              await supabaseAdmin
                .from("transactions")
                .update({
                  status: "settled",
                  tx_hash: settlement.transaction,
                  settlement_id: settlementId,
                })
                .eq("id", intent.id)
              return {
                intentId: intent.id,
                success: true as const,
                transaction: settlement.transaction,
                amount: parseFloat(intent.amount),
                from: intent.from_address,
                to: intent.to_address,
              }
            } else {
              const reason = settlement.errorReason ?? "Settlement rejected by facilitator"
              await supabaseAdmin
                .from("transactions")
                .update({ status: "failed", error_reason: reason })
                .eq("id", intent.id)
              return { intentId: intent.id, success: false as const, error: reason }
            }
          } catch (err) {
            const reason = err instanceof Error ? err.message : "Unknown error"
            await supabaseAdmin
              .from("transactions")
              .update({ status: "failed", error_reason: reason })
              .eq("id", intent.id)
            return { intentId: intent.id, success: false as const, error: reason }
          }
        })
      )

      for (const r of batchResults) {
        results.push(r)
        if (r.success) {
          if ("amount" in r) totalAmount += r.amount
          if ("from" in r && r.from) settledSenders.push(r.from)
          if ("to" in r && r.to) settledRecipients.push(r.to)
        }
      }
    }

    // Fire push notifications (non-blocking)
    const succeeded = results.filter((r) => r.success).length
    if (succeeded > 0) {
      const uniqueSenders = [...new Set(settledSenders)]
      const uniqueRecipients = [...new Set(settledRecipients)]

      sendPushToAddress(uniqueSenders, {
        title: "Payment settled ✓",
        body: `${succeeded} intent${succeeded !== 1 ? "s" : ""} settled — $${formatUsdc(totalAmount)} USDC on-chain`,
        url: "/dashboard",
      }).catch(() => {})

      sendPushToAddress(uniqueRecipients, {
        title: "You received USDC 💵",
        body: `$${formatUsdc(totalAmount)} USDC settled to your wallet`,
        url: "/dashboard",
      }).catch(() => {})
    }

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
