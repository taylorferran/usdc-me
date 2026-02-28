"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import * as api from "@/lib/api"
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
  process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export default function MerchantPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [storeName, setStoreName] = useState("")
  const [callbackUrl, setCallbackUrl] = useState("")
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [merchant, setMerchant] = useState<api.MerchantResponse | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login?next=/merchant")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
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
      setMerchant(res)
      toast.success("Merchant account created!")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed"
      setError(msg)
    } finally {
      setRegistering(false)
    }
  }

  const widgetSnippet = `<div id="usdcme-pay"
     data-payment-id="YOUR_PAYMENT_ID"
     data-base-url="${FRONTEND_URL}">
</div>
<script src="${FRONTEND_URL}/widget.js"><\/script>`

  const createPaymentSnippet = merchant
    ? `fetch("${API_URL}/api/payments/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${merchant.api_key}"
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
    : ""

  // ── Registered state ──
  if (merchant) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Merchant Setup</h1>
          <p className="text-muted-foreground text-sm">
            {merchant.name} — @{user.handle}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your API Key</CardTitle>
            <CardDescription>
              Keep this secret. Use it server-side to create payment requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">
              {merchant.api_key}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => copy(merchant.api_key, "apiKey")}
            >
              {copied === "apiKey" ? "Copied!" : "Copy API Key"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              1. Create a Payment Request
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
            <CardTitle className="text-base">
              2. Add the Widget to Your Site
            </CardTitle>
            <CardDescription>
              Paste this HTML where you want the &quot;Pay with USDC.me&quot;
              button. Replace YOUR_PAYMENT_ID with the payment_id from step 1.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs leading-relaxed">
              {widgetSnippet}
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(widgetSnippet, "widget")}
            >
              {copied === "widget" ? "Copied!" : "Copy Widget Code"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              3. Listen for Payment
            </CardTitle>
            <CardDescription>
              The widget fires a DOM event when the customer pays.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs leading-relaxed">
{`document.addEventListener("usdcme:payment", (e) => {
  console.log("Paid!", e.detail);
  // { paymentId, intentId, status: "paid" }
});`}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Page URL</CardTitle>
            <CardDescription>
              Direct customers to this URL pattern:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-3 font-mono text-xs">
              {FRONTEND_URL}/pay/YOUR_PAYMENT_ID
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
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

      <Button variant="outline" asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
