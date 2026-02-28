"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import * as api from "@/lib/api"
import { formatUsdc } from "@/lib/format"
import { signX402Payment } from "@/lib/signing"
import { ARC_CHAIN_ID } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentContent />
    </Suspense>
  )
}

function PaymentContent() {
  const params = useParams<{ paymentId: string }>()
  const searchParams = useSearchParams()
  const isEmbed = searchParams.get("embed") === "true"
  const { user, privateKey, decryptKey } = useAuth()

  const [payment, setPayment] = useState<api.PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState("")
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    if (!params.paymentId) return
    api
      .getPaymentDetails(params.paymentId)
      .then(setPayment)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.paymentId])

  const handlePay = async () => {
    if (!user?.address || !privateKey || !payment || !params.paymentId)
      return
    setPaying(true)
    setError(null)
    try {
      const amountAtomic = Math.round(
        parseFloat(payment.amount) * 1e6,
      ).toString()

      const signedPayload = await signX402Payment(
        privateKey,
        payment.merchant_wallet as `0x${string}`,
        amountAtomic,
        ARC_CHAIN_ID,
      )

      const res = await api.payPaymentRequest(
        params.paymentId,
        user.address,
        signedPayload,
      )
      setPaid(true)
      toast.success(`Paid ${formatUsdc(payment.amount)} USDC!`)

      // Notify widget opener via postMessage if embedded
      if (isEmbed && window.opener) {
        window.opener.postMessage(
          {
            type: "usdcme:payment_success",
            paymentId: params.paymentId,
            intentId: res.intentId,
          },
          "*",
        )
      }

      // Redirect after short delay if redirect_url set
      if (payment.redirect_url && !isEmbed) {
        setTimeout(() => {
          window.location.href = payment.redirect_url!
        }, 2000)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed"
      setError(msg)
    } finally {
      setPaying(false)
    }
  }

  const handleUnlock = async () => {
    setUnlocking(true)
    setError(null)
    try {
      await decryptKey(unlockPassword)
      setUnlockPassword("")
    } catch {
      setError("Wrong password. Please try again.")
    } finally {
      setUnlocking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
        <Spinner />
      </div>
    )
  }

  if (error && !payment) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <Alert className="border-destructive/50 text-destructive text-sm">
              {error}
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!payment) return null

  const isPaid = payment.status === "paid" || paid
  const isExpired = payment.status === "expired"

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        {/* Merchant info */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
              {payment.merchant_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{payment.merchant_name}</h1>
            {payment.description && (
              <p className="text-muted-foreground text-sm">
                {payment.description}
              </p>
            )}
          </div>
        </div>

        {/* Payment card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">
              ${formatUsdc(payment.amount)}
            </CardTitle>
            <CardDescription>USDC</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paid state */}
            {isPaid && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="animate-in zoom-in-50 fade-in duration-300 rounded-full bg-green-500/10 p-4">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    strokeWidth={1.5}
                    className="size-12 text-green-500"
                  />
                </div>
                <p className="animate-in fade-in slide-in-from-bottom-2 duration-300 font-medium">
                  Payment successful!
                </p>
                {payment.redirect_url && !isEmbed && (
                  <p className="animate-in fade-in slide-in-from-bottom-2 duration-500 text-muted-foreground text-xs">
                    Redirecting back to merchant...
                  </p>
                )}
              </div>
            )}

            {/* Expired state */}
            {isExpired && (
              <div className="space-y-3 text-center">
                <Badge variant="destructive">Expired</Badge>
                <p className="text-muted-foreground text-sm">
                  This payment request has expired. Please ask the merchant for
                  a new link.
                </p>
              </div>
            )}

            {/* Pending — logged in, wallet unlocked */}
            {!isPaid && !isExpired && user && privateKey && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-center text-xs">
                  Paying as @{user.handle}
                </p>
                {error && (
                  <Alert className="border-destructive/50 text-destructive text-sm">
                    {error}
                  </Alert>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePay}
                  disabled={paying}
                >
                  {paying ? (
                    <>
                      <Spinner className="mr-2" />
                      Paying...
                    </>
                  ) : (
                    `Pay $${formatUsdc(payment.amount)}`
                  )}
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  Instant, gasless x402 payment
                </p>
              </div>
            )}

            {/* Pending — logged in, need password to unlock wallet */}
            {!isPaid && !isExpired && user && !privateKey && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-center text-xs">
                  Paying as @{user.handle}
                </p>
                <p className="text-muted-foreground text-center text-xs">
                  Enter your password to unlock your wallet
                </p>
                {error && (
                  <Alert className="border-destructive/50 text-destructive text-sm">
                    {error}
                  </Alert>
                )}
                <Input
                  type="password"
                  placeholder="Password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleUnlock}
                  disabled={unlocking || !unlockPassword}
                >
                  {unlocking ? (
                    <>
                      <Spinner className="mr-2" />
                      Unlocking...
                    </>
                  ) : (
                    "Unlock & Continue"
                  )}
                </Button>
              </div>
            )}

            {/* Pending — not logged in */}
            {!isPaid && !isExpired && !user && (
              <div className="space-y-3">
                <Button className="w-full" size="lg" asChild>
                  <Link
                    href={`/register?next=/pay/${params.paymentId}`}
                  >
                    Sign up to pay
                  </Link>
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  Already have an account?{" "}
                  <Link
                    href={`/login?next=/pay/${params.paymentId}`}
                    className="text-primary hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
