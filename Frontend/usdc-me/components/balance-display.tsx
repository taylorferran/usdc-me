"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import type { BalanceResponse } from "@/lib/api"
import * as api from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

function BalanceLine({
  label,
  value,
  isLoading,
  highlight,
}: {
  label: string
  value: string
  isLoading: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className={highlight ? "text-primary font-semibold text-base" : "font-medium"}>
          ${value}
        </span>
      )}
    </div>
  )
}

export function BalanceDisplay() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!user?.address) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getBalance(user.address)
      setBalance(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load balance")
    } finally {
      setIsLoading(false)
    }
  }, [user?.address])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  const pending =
    balance
      ? (
          parseFloat(balance.gateway.total) -
          parseFloat(balance.gateway.available)
        ).toFixed(2)
      : "0.00"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Balance</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchBalance}
            disabled={isLoading}
            aria-label="Refresh balance"
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <>
            <BalanceLine
              label="Gateway Available"
              value={balance?.gateway.available ?? "—"}
              isLoading={isLoading}
              highlight
            />
            <Separator />
            <BalanceLine
              label="Gateway Total"
              value={balance?.gateway.total ?? "—"}
              isLoading={isLoading}
            />
            <BalanceLine
              label="Pending"
              value={isLoading ? "—" : pending}
              isLoading={isLoading}
            />
            <Separator />
            <BalanceLine
              label="Wallet (on-chain)"
              value={balance?.wallet.balance ?? "—"}
              isLoading={isLoading}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
