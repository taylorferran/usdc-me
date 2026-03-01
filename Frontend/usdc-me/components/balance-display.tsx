"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon, Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import type { BalanceResponse } from "@/lib/api"
import * as api from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { formatUsdc } from "@/lib/format"

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

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`
}

const POLL_INTERVAL_MS = 30_000

export function BalanceDisplay() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const addressRef = useRef(user?.address)
  addressRef.current = user?.address

  async function handleCopyAddress() {
    if (!user?.address) return
    await navigator.clipboard.writeText(user.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fetchBalance = useCallback(async (silent = false) => {
    if (!addressRef.current) return
    if (!silent) setIsLoading(true)
    if (!silent) setError(null)
    try {
      const data = await api.getBalance(addressRef.current)
      setBalance(data)
      if (!silent) setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Failed to load balance")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance, user?.address])

  // Poll every 30s — balance comes from an external API, not Supabase
  useEffect(() => {
    if (!user?.address) return
    const id = setInterval(() => fetchBalance(true), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [user?.address, fetchBalance])

  const pending = balance
    ? formatUsdc(parseFloat(balance.gateway.total) - parseFloat(balance.gateway.available))
    : "0.00"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Balance</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fetchBalance()}
            disabled={isLoading}
            aria-label="Refresh balance"
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Wallet address */}
        {user?.address && (
          <>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Your Wallet Address
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs break-all">
                  {truncate(user.address)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCopyAddress}
                      aria-label="Copy wallet address"
                      className="shrink-0"
                    >
                      <HugeiconsIcon
                        icon={copied ? Tick01Icon : Copy01Icon}
                        strokeWidth={2}
                        className={`size-3.5 ${copied ? "text-green-500" : ""}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? "Copied!" : "Copy address"}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Separator />
          </>
        )}

        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <>
            <BalanceLine
              label="Gateway Available"
              value={balance ? formatUsdc(balance.gateway.available) : "—"}
              isLoading={isLoading}
              highlight
            />
            <Separator />
            <BalanceLine
              label="Gateway Total"
              value={balance ? formatUsdc(balance.gateway.total) : "—"}
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
              value={balance ? formatUsdc(balance.wallet.balance) : "—"}
              isLoading={isLoading}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
