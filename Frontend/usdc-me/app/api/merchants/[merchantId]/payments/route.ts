import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"
import { extractUserWallet } from "@/lib/server/auth"

export const runtime = "nodejs"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params

    const result = await extractUserWallet(req)
    if (result instanceof NextResponse) return result
    const { wallet } = result

    // Verify merchant belongs to this user
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, wallet_address")
      .eq("id", merchantId)
      .single()

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 })
    }

    if (merchant.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Optional status filter
    const url = new URL(req.url)
    const status = url.searchParams.get("status")

    // Fetch payment requests
    let query = supabaseAdmin
      .from("payment_requests")
      .select(
        "id, amount, description, status, payer_address, intent_id, expires_at, created_at"
      )
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(500)

    if (status && ["pending", "paid", "expired"].includes(status)) {
      query = query.eq("status", status)
    }

    const { data: payments, error: paymentsError } = await query
    if (paymentsError) throw paymentsError

    // Compute summary from all payments (unfiltered)
    const { data: allPayments } = await supabaseAdmin
      .from("payment_requests")
      .select("amount, status")
      .eq("merchant_id", merchantId)

    let totalPaid = 0
    let totalPending = 0
    let totalExpired = 0
    let revenue = 0
    let pendingAmount = 0

    for (const p of allPayments ?? []) {
      if (p.status === "paid") {
        totalPaid++
        revenue += parseFloat(p.amount)
      } else if (p.status === "pending") {
        totalPending++
        pendingAmount += parseFloat(p.amount)
      } else if (p.status === "expired") {
        totalExpired++
      }
    }

    return NextResponse.json({
      payments: payments ?? [],
      summary: {
        total_payments: (allPayments ?? []).length,
        total_paid: totalPaid,
        total_pending: totalPending,
        total_expired: totalExpired,
        revenue: revenue.toFixed(2),
        pending_amount: pendingAmount.toFixed(2),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch payments", details: message },
      { status: 500 }
    )
  }
}
