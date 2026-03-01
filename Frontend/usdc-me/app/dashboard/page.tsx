"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { BalanceDisplay } from "@/components/balance-display"
import { QRCodeDisplay } from "@/components/qr-code-display"
import { TransactionList } from "@/components/transaction-list"
import { WithdrawModal } from "@/components/withdraw-modal"
import { AddFundsButton } from "@/components/add-funds-button"

import { SpendIntentsCard } from "@/components/spend-intents-card"
import { SendUsdcCard } from "@/components/send-usdc-card"
import { QrScannerDialog } from "@/components/qr-scanner-dialog"
import { FaucetButton } from "@/components/faucet-button"
import { PushNotificationManager } from "@/components/push-notification-manager"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const welcomeHandle = searchParams.get("welcome")
    if (welcomeHandle) {
      toast.success(`@${welcomeHandle} created! Welcome to USDC-ME`)
      // Remove the param from the URL without triggering a re-render
      router.replace("/dashboard", { scroll: false })
    }
  }, [searchParams, router])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:space-y-6 md:py-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Hide verbose title on mobile — the handle is sufficient context */}
          <h1 className="text-2xl font-bold sm:block">Dashboard</h1>
          <p className="text-base font-semibold sm:text-sm sm:font-normal sm:text-muted-foreground">
            @{user.handle}
          </p>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <PushNotificationManager />
          <FaucetButton />
          <QrScannerDialog />
          <AddFundsButton />
          <WithdrawModal />
        </div>
      </div>

      <Separator />

      {/*
        Single responsive grid.
        Mobile (1-col): QR → Balance → Send → Transactions → Spend Intents
        Desktop (2-col): Balance | QR  /  Send | Intents  /  Transactions (full-width)
      */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {/* Payment link — 1st on mobile, right col row 1 on desktop */}
        <div className="order-1 md:order-2">
          <QRCodeDisplay handle={user.handle} />
        </div>

        {/* Balance — 2nd on mobile, left col row 1 on desktop */}
        <div className="order-2 md:order-1">
          <BalanceDisplay />
        </div>

        {/* Send — 3rd on both; left col row 2 on desktop */}
        <div className="order-3">
          <SendUsdcCard />
        </div>

        {/* Transactions — 4th on mobile (before intents), full-width row 3 on desktop */}
        <div className="order-4 md:order-5 md:col-span-2">
          <TransactionList userAddress={user.address} />
        </div>

        {/* Spend Intents — last on mobile, right col row 2 on desktop */}
        <div className="order-5 md:order-4">
          <SpendIntentsCard />
        </div>
      </div>
    </div>
  )
}
