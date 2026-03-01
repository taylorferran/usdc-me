"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import * as api from "@/lib/api"
import type { MerchantAccount } from "@/lib/api"
import { MerchantDashboard } from "@/components/merchant-dashboard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ?? "https://www.usdc-me.xyz"

export default function MerchantPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // Existing merchant accounts
  const [merchants, setMerchants] = useState<MerchantAccount[] | null>(null)
  const [loadingMerchants, setLoadingMerchants] = useState(true)

  // Registration form
  const [showRegister, setShowRegister] = useState(false)
  const [storeName, setStoreName] = useState("")
  const [callbackUrl, setCallbackUrl] = useState("")
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Just-registered merchant (show API key once)
  const [justRegistered, setJustRegistered] = useState<api.MerchantResponse | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const fetchMerchants = useCallback(async () => {
    try {
      const res = await api.getMyMerchants()
      setMerchants(res.merchants)
    } catch {
      setMerchants([])
    } finally {
      setLoadingMerchants(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/merchant")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) fetchMerchants()
  }, [user, fetchMerchants])

  if (authLoading || loadingMerchants) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {/* Page header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Registration / dashboard card */}
        <div className="rounded-xl border p-6 space-y-5">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          {/* Store name field */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          {/* Receiving wallet field */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          {/* Callback URL field */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    )
  }

  if (!user) return null

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegister = async () => {
    if (!storeName.trim()) return
    setRegistering(true)
    setError(null)
    try {
      const res = await api.registerMerchant({
        name: storeName.trim(),
        email: user.handle + "@usdcme.local",
        wallet_address: user.address,
        ...(callbackUrl.trim() && { callback_url: callbackUrl.trim() }),
      })
      setJustRegistered(res)
      toast.success("Merchant account created!")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed"
      setError(msg)
    } finally {
      setRegistering(false)
    }
  }

  const handleDoneSetup = () => {
    setJustRegistered(null)
    setShowRegister(false)
    setStoreName("")
    setCallbackUrl("")
    setLoadingMerchants(true)
    fetchMerchants()
  }

  // ── Just-registered: show API key + setup instructions ──
  if (justRegistered) {
    const createPaymentSnippet = `fetch("${FRONTEND_URL}/api/payments/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${justRegistered.api_key}"
  },
  body: JSON.stringify({
    amount: "10",
    description: "Your product description",
    redirect_url: "https://your-site.com/thank-you"
  })
})
.then(res => res.json())
.then(data => {
  // data.payment_id  — use in widget or QR code
  // data.payment_url — direct link for customer
  console.log(data);
});`

    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Merchant Setup</h1>
          <p className="text-muted-foreground text-sm">
            {justRegistered.name} — @{user.handle}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your API Key</CardTitle>
            <CardDescription>
              Keep this secret. This is the only time it will be shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">
              {justRegistered.api_key}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => copy(justRegistered.api_key, "apiKey")}
            >
              {copied === "apiKey" ? "Copied!" : "Copy API Key"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Create a Payment Request
            </CardTitle>
            <CardDescription>
              Call this from your server when a customer checks out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs leading-relaxed">
              {createPaymentSnippet}
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(createPaymentSnippet, "createPayment")}
            >
              {copied === "createPayment" ? "Copied!" : "Copy Code"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook Callback</CardTitle>
            <CardDescription>
              When a customer pays, we POST to your callback URL:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs leading-relaxed">
{`{
  "event": "payment.completed",
  "payment_id": "pay_abc123",
  "amount": "10.00",
  "payer_address": "0x...",
  "intent_id": "uuid",
  "timestamp": "2025-01-15T10:30:45.123Z"
}`}
            </pre>
            <p className="text-muted-foreground mt-3 text-xs">
              Or poll{" "}
              <code className="text-primary">
                GET /api/payments/:paymentId
              </code>{" "}
              for status changes.
            </p>
          </CardContent>
        </Card>

        <Button onClick={handleDoneSetup}>Go to Merchant Dashboard</Button>
      </div>
    )
  }

  // ── Has merchants + not registering: show dashboard ──
  if (merchants && merchants.length > 0 && !showRegister) {
    return (
      <MerchantDashboard
        merchants={merchants}
        userHandle={user.handle}
        onRegisterNew={() => setShowRegister(true)}
      />
    )
  }

  // ── Registration form ──
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Merchant Setup</h1>
        <p className="text-muted-foreground text-sm">
          Accept USDC payments on your site via x402
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register as a Merchant</CardTitle>
          <CardDescription>
            Payments are signed client-side via x402 — instant and gasless for
            your customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert className="border-destructive/50 text-destructive text-sm">
              {error}
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input
              id="storeName"
              placeholder="My Awesome Store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Receiving Wallet</Label>
            <div className="bg-muted text-muted-foreground rounded-lg p-3 font-mono text-xs break-all">
              {user.address}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="callbackUrl">
              Webhook Callback URL{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="callbackUrl"
              placeholder="https://your-site.com/webhooks/usdcme"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleRegister}
            disabled={registering || !storeName.trim()}
          >
            {registering ? "Registering..." : "Register as Merchant"}
          </Button>
        </CardContent>
      </Card>

      {merchants && merchants.length > 0 ? (
        <Button variant="outline" onClick={() => setShowRegister(false)}>
          Back to Merchant Dashboard
        </Button>
      ) : (
        <Button variant="default" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      )}
    </div>
  )
}
