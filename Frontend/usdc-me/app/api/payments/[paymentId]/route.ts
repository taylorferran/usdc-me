import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params

    const { data: payment, error } = await supabaseAdmin
      .from("payment_requests")
      .select("*, merchants(name, wallet_address)")
      .eq("id", paymentId)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Auto-expire
    let status = payment.status
    if (status === "pending" && new Date(payment.expires_at) < new Date()) {
      status = "expired"
      await supabaseAdmin
        .from("payment_requests")
        .update({ status: "expired" })
        .eq("id", paymentId)
    }

    const merchant = payment.merchants as any

    return NextResponse.json({
      payment_id: payment.id,
      merchant_name: merchant?.name ?? "Unknown",
      merchant_wallet: merchant?.wallet_address ?? "",
      amount: payment.amount,
      description: payment.description,
      status,
      redirect_url: payment.redirect_url,
      expires_at: payment.expires_at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Failed to fetch payment", details: message }, { status: 500 })
  }
}
