import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { email, newPassword, newEncryptedKeyBlob } = await req.json()

    if (!email || !newPassword || !newEncryptedKeyBlob) {
      return NextResponse.json(
        { error: "email, newPassword, and newEncryptedKeyBlob are required" },
        { status: 400 }
      )
    }

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw new Error(listError.message)

    const user = users.find((u) => u.email === email)
    if (!user) {
      return NextResponse.json({ error: "No account found with that email" }, { status: 404 })
    }

    // Reset Supabase auth password via admin API
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })
    if (pwError) throw new Error(`Password reset failed: ${pwError.message}`)

    // Update encrypted key blob in profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ encrypted_key_blob: newEncryptedKeyBlob })
      .eq("id", user.id)
    if (updateError) throw new Error(`Profile update failed: ${updateError.message}`)

    return NextResponse.json({ status: "recovered" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Recovery failed", details: message }, { status: 500 })
  }
}
