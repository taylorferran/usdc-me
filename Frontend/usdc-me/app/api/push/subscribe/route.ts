import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { subscription, userAddress } = await req.json()

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
    }

    if (!userAddress) {
      return NextResponse.json({ error: "userAddress is required" }, { status: 400 })
    }

    // Upsert so re-subscribing the same endpoint just updates it
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_address: userAddress,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
