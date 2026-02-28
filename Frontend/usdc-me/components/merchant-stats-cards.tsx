"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentSummary, BalanceResponse } from "@/lib/api"
import { formatUsdc } from "@/lib/format"

interface MerchantStatsCardsProps {
  summary: PaymentSummary | null
  balance: BalanceResponse | null
  isLoading: boolean
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  isLoading,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  isLoading: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <>
            <p
              className={`text-xl font-bold ${highlight ? "text-green-600 dark:text-green-400" : ""}`}
            >
              {value}
            </p>
            {sub && (
              <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function MerchantStatsCards({
  summary,
  balance,
  isLoading,
}: MerchantStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        label="Total Revenue"
        value={`$${summary?.revenue ?? "0.00"}`}
        isLoading={isLoading}
        highlight
      />
      <StatCard
        label="Payments Received"
        value={String(summary?.total_paid ?? 0)}
        isLoading={isLoading}
      />
      <StatCard
        label="Pending"
        value={String(summary?.total_pending ?? 0)}
        sub={summary ? `$${formatUsdc(summary.pending_amount)} USDC` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Wallet Balance"
        value={balance ? `$${formatUsdc(balance.gateway.available)}` : "$0.00"}
        sub="Gateway available"
        isLoading={isLoading}
      />
    </div>
  )
}
