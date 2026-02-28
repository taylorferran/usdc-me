import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PaymentForm } from "@/components/payment-form"

interface HandlePageProps {
  params: Promise<{ handle: string }>
}

export default async function HandlePage({ params }: HandlePageProps) {
  const { handle } = await params

  // Strip @ prefix if present (Next.js strips @ from params due to parallel route
  // reserved syntax, so /@salty arrives as "salty", but handle both to be safe)
  const cleanHandle = handle.replace(/^@/, "").toLowerCase()

  if (!cleanHandle) notFound()

  // Query Supabase directly — profiles are publicly readable
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, wallet_address")
    .eq("handle", cleanHandle)
    .single()

  if (!profile || !profile.wallet_address) {
    notFound()
  }

  const recipient = { handle: profile.handle, address: profile.wallet_address }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        {/* Recipient */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
              {cleanHandle.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">@{recipient.handle}</h1>
            <p className="text-muted-foreground font-mono text-xs">
              {recipient.address.slice(0, 8)}…{recipient.address.slice(-6)}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Accepts USDC on Arc
          </Badge>
        </div>

        {/* Payment card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send USDC</CardTitle>
            <CardDescription>
              Instant, gasless x402 payment to @{cleanHandle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentForm handle={cleanHandle} recipientAddress={recipient.address} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          Powered by{" "}
          <span className="font-medium">USDC.me</span> &middot; Circle x402 on
          Arc
        </p>
      </div>
    </div>
  )
}
