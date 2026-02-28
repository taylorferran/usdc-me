import { NextResponse } from "next/server"
import { getFacilitator, getSupportedKinds, ARC_NETWORK, ARC_USDC_ADDRESS } from "@/lib/server/gateway"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { from, to, amount, signedPayload } = await req.json()

    if (!from || !to || !amount || !signedPayload) {
      return NextResponse.json(
        { error: "Missing required fields: from, to, amount, signedPayload" },
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
          arcKind?.extra?.verifyingContract ??
          "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
      },
    }

    // Use the incoming request URL so this works on any host (local or deployed)
    const resource = {
      url: new URL("/api/send-signed", req.url).toString(),
      description: `Send ${amount} USDC to ${to}`,
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

    await supabaseAdmin.from("transactions").insert({
      id: intentId,
      type: "send",
      from_address: from,
      to_address: to,
      amount,
      status: "pending",
      intent_id: intentId,
      network: ARC_NETWORK,
      payload: fullPayload,
      accepted,
    })

    return NextResponse.json({ status: "intent_queued", intentId, amount })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Send failed", details: message },
      { status: 500 }
    )
  }
}
