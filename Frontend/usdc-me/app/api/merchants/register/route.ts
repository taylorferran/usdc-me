import { NextResponse } from "next/server"
import { isAddress } from "viem"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { name, email, wallet_address, callback_url } = await req.json()

    if (!name || !email || !wallet_address) {
      return NextResponse.json(
        { error: "name, email, and wallet_address are required" },
        { status: 400 }
      )
    }

    if (!isAddress(wallet_address)) {
      return NextResponse.json({ error: "Invalid wallet_address" }, { status: 400 })
    }

    // Generate a random API key
    const apiKey =
      "usdcme_" +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

    const { data: merchant, error } = await supabaseAdmin
      .from("merchants")
      .insert({ name, email, wallet_address, api_key: apiKey, callback_url: callback_url ?? null })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Registration failed", details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        merchant_id: merchant.id,
        api_key: apiKey,
        name: merchant.name,
        wallet_address: merchant.wallet_address,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Registration failed", details: message }, { status: 500 })
  }
}
