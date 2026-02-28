import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key")
    if (!apiKey) {
      return NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 })
    }

    const { data: merchant, error: authError } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("api_key", apiKey)
      .single()

    if (authError || !merchant) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const { amount, description, redirect_url, callback_url } = await req.json()
    if (!amount) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 })
    }

    const paymentId =
      "pay_" +
      btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(8))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { error } = await supabaseAdmin.from("payment_requests").insert({
      id: paymentId,
      merchant_id: merchant.id,
      amount,
      description: description ?? null,
      redirect_url: redirect_url ?? null,
      callback_url: callback_url ?? null,
      expires_at: expiresAt,
    })

    if (error) {
      return NextResponse.json({ error: "Failed to create payment", details: error.message }, { status: 400 })
    }

    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? new URL(req.url).origin
    const paymentUrl = `${frontendUrl}/pay/${paymentId}`

    return NextResponse.json(
      {
        payment_id: paymentId,
        payment_url: paymentUrl,
        qr_data: paymentUrl,
        amount,
        description: description ?? null,
        status: "pending",
        expires_at: expiresAt,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Failed to create payment", details: message }, { status: 500 })
  }
}
