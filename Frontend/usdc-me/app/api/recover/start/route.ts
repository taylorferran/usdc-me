import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Requires service role to list users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw new Error(listError.message)

    const user = users.find((u) => u.email === email)
    if (!user) {
      return NextResponse.json({ error: "No account found with that email" }, { status: 404 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("recovery_key_blob, wallet_address")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (!profile.recovery_key_blob) {
      return NextResponse.json({ error: "No recovery key set for this account" }, { status: 400 })
    }

    return NextResponse.json({
      recovery_key_blob: profile.recovery_key_blob,
      wallet_address: profile.wallet_address,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Recovery failed", details: message }, { status: 500 })
  }
}
