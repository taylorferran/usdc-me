import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "./supabase"

/**
 * Extract Bearer token from request, verify it, and return the user's wallet address.
 * Returns a NextResponse error if auth fails — callers should check and return it.
 */
export async function extractUserWallet(
  req: Request
): Promise<{ wallet: string } | NextResponse> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.slice(7)

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token)

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("wallet_address")
    .eq("id", user.id)
    .single()

  if (!profile?.wallet_address) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  return { wallet: profile.wallet_address }
}
