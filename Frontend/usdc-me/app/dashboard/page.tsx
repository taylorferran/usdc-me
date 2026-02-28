"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { BalanceDisplay } from "@/components/balance-display"
import { QRCodeDisplay } from "@/components/qr-code-display"
import { TransactionList } from "@/components/transaction-list"
import { SettleButton } from "@/components/settle-button"
import { WithdrawModal } from "@/components/withdraw-modal"
import { AddFundsButton } from "@/components/add-funds-button"
import { SpendIntentsCard } from "@/components/spend-intents-card"
import { SendUsdcCard } from "@/components/send-usdc-card"
import { QrScannerDialog } from "@/components/qr-scanner-dialog"
import { FaucetButton } from "@/components/faucet-button"
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">@{user.handle}</p>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <FaucetButton />
          <QrScannerDialog />
          <AddFundsButton />
          <WithdrawModal />
          <SettleButton />
        </div>
      </div>

      <Separator />

      {/* Top row — balance + QR */}
      <div className="grid gap-6 md:grid-cols-2">
        <BalanceDisplay />
        <QRCodeDisplay handle={user.handle} />
      </div>

      {/* Middle row — send + intents */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SendUsdcCard />
        <SpendIntentsCard />
      </div>

      {/* Transactions — full width */}
      <TransactionList userAddress={user.address} />
    </div>
  )
}
