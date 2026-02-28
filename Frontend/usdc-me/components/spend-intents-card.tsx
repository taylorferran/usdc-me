"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon, CheckmarkCircle01Icon, Clock01Icon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/contexts/auth-context"
import * as api from "@/lib/api"
import type { Intent } from "@/lib/api"
import { formatUsdc } from "@/lib/format"

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`
}

function IntentRow({ intent }: { intent: Intent }) {
  const isPending = intent.status === "pending"
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-medium leading-none">
          {truncate(intent.from || "unknown")} → {truncate(intent.to)}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {new Date(intent.timestamp).toLocaleString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold">${formatUsdc(intent.amount)} USDC</span>
        {isPending ? (
          <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
            <HugeiconsIcon icon={Clock01Icon} className="size-3" />
            Pending
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-300 dark:text-green-400 dark:border-green-700">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
            Settled
          </Badge>
        )}
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="divide-y">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

interface SettlementResult {
  settled: number
  failed: number
  totalAmount: number
}

export function SpendIntentsCard() {
  const { user } = useAuth()
  const [intents, setIntents] = useState<Intent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSettling, setIsSettling] = useState(false)
  const [lastSettlement, setLastSettlement] = useState<SettlementResult | null>(null)

  const fetchIntents = useCallback(async () => {
    if (!user?.address) return
    setIsLoading(true)
    try {
      const data = await api.getIntents(user.address)
      setIntents(data)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [user?.address])

  useEffect(() => {
    fetchIntents()
  }, [fetchIntents])

  const pendingCount = intents.filter((i) => i.status === "pending").length

  async function handleSettle() {
    setIsSettling(true)
    setLastSettlement(null)
    try {
      const res = await api.settle()
      if (res.settled === 0 && res.failed === 0) {
        toast.info("No pending intents to settle.")
      } else {
        setLastSettlement({ settled: res.settled, failed: res.failed, totalAmount: res.totalAmount })
        toast.success(
          `${res.settled} intent${res.settled !== 1 ? "s" : ""} → 1 batch on Arc ✓ ($${formatUsdc(res.totalAmount)} USDC)`
        )
      }
      await fetchIntents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed")
    } finally {
      setIsSettling(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Spend Intents</CardTitle>
            {pendingCount > 0 && (
              <Badge className="text-xs">{pendingCount} pending</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchIntents}
            disabled={isLoading}
            aria-label="Refresh intents"
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Intents list */}
        {isLoading ? (
          <SkeletonRows />
        ) : intents.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No intents yet. Send USDC to create one.
          </p>
        ) : (
          <ScrollArea className="h-56">
            <div className="divide-y">
              {intents.map((intent) => (
                <IntentRow key={intent.id} intent={intent} />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Settle Now button */}
        <Button
          className="w-full gap-2"
          onClick={handleSettle}
          disabled={isSettling || pendingCount === 0}
        >
          {isSettling ? (
            <>
              <Spinner className="size-4" />
              Settling…
            </>
          ) : (
            `Settle Now (${pendingCount} intent${pendingCount !== 1 ? "s" : ""})`
          )}
        </Button>

        <p className="text-muted-foreground text-xs text-center">
          Batches all pending x402 intents into a single on-chain transaction on Arc
        </p>

        {/* Last settlement result */}
        {lastSettlement && (
          <div className="bg-muted/50 rounded-lg border p-3 space-y-1.5">
            <p className="text-sm font-medium">Last settlement</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Intents settled</span>
              <span className="font-mono font-medium">{lastSettlement.settled}</span>
            </div>
            {lastSettlement.failed > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-mono font-medium text-destructive">{lastSettlement.failed}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total USDC</span>
              <span className="font-mono font-medium">${formatUsdc(lastSettlement.totalAmount)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
