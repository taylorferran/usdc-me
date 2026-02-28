import { NextResponse } from "next/server"
import { getFacilitator, getSupportedKinds, createPlatformGateway, ARC_NETWORK, ARC_USDC_ADDRESS } from "@/lib/server/gateway"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const { from, signedPayload } = await req.json()

    if (!from || !signedPayload) {
      return NextResponse.json({ error: "from and signedPayload are required" }, { status: 400 })
    }

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from("payment_requests")
      .select("*, merchants(name, wallet_address, callback_url)")
      .eq("id", paymentId)
      .single()

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ error: `Payment is already ${payment.status}` }, { status: 400 })
    }

    if (new Date(payment.expires_at) < new Date()) {
      await supabaseAdmin.from("payment_requests").update({ status: "expired" }).eq("id", paymentId)
      return NextResponse.json({ error: "Payment has expired" }, { status: 400 })
    }

    const merchant = payment.merchants as any
    const to = merchant?.wallet_address
    if (!to) {
      return NextResponse.json({ error: "Merchant wallet not found" }, { status: 500 })
    }

    const amount = payment.amount

    // Check payer has sufficient Gateway balance before accepting
    const gateway = createPlatformGateway()
    const balances = await gateway.getBalances(from as `0x${string}`)
    const available = parseFloat(balances.gateway.formattedAvailable)
    if (available < parseFloat(amount)) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${available.toFixed(2)} USDC, Required: ${amount} USDC` },
        { status: 400 }
      )
    }

    const amountAtomic = Math.round(parseFloat(amount) * 1e6).toString()
    const supportedKinds = await getSupportedKinds()
    const arcKind = supportedKinds.find((k) => k.network === ARC_NETWORK)

    const accepted = {
      scheme: "exact",
      network: ARC_NETWORK,
      asset:
        (arcKind?.extra as any)?.assets?.[0]?.address ??
        arcKind?.extra?.asset ??
        ARC_USDC_ADDRESS,
      amount: amountAtomic,
      maxTimeoutSeconds: 345600,
      payTo: to,
      extra: {
        name: "GatewayWalletBatched",
        version: "1",
        verifyingContract:
          arcKind?.extra?.verifyingContract ?? "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
      },
    }

    const resource = {
      url: new URL("/api/send-signed", req.url).toString(),
      description: `Pay ${amount} USDC to ${merchant?.name ?? to}`,
      mimeType: "application/json",
    }

    const fullPayload = { ...signedPayload, resource, accepted }

    const facilitator = getFacilitator()
    const verification = await facilitator.verify(fullPayload, accepted)

    if (!verification.isValid) {
      return NextResponse.json(
        { error: "Verification failed", reason: verification.invalidReason },
        { status: 400 }
      )
    }

    const intentId = crypto.randomUUID()

    // Save transaction — check for insert errors so we don't orphan the payment
    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      id: intentId,
      type: "merchant_payment",
      from_address: from,
      to_address: to,
      amount,
      status: "pending",
      intent_id: intentId,
      network: ARC_NETWORK,
      payload: fullPayload,
      accepted,
    })

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save transaction", details: insertError.message },
        { status: 500 }
      )
    }

    // Mark payment as paid (only after transaction is saved)
    const { error: updateError } = await supabaseAdmin
      .from("payment_requests")
      .update({ status: "paid", payer_address: from, intent_id: intentId })
      .eq("id", paymentId)

    if (updateError) {
      return NextResponse.json(
        { error: "Transaction saved but failed to update payment status", details: updateError.message },
        { status: 500 }
      )
    }

    // Fire webhook (non-blocking)
    const callbackUrl = payment.callback_url ?? merchant?.callback_url
    if (callbackUrl) {
      fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "payment.completed",
          payment_id: paymentId,
          amount,
          payer_address: from,
          intent_id: intentId,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {})
    }

    return NextResponse.json({
      status: "paid",
      intentId,
      amount,
      redirect_url: payment.redirect_url,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Payment failed", details: message }, { status: 500 })
  }
}
