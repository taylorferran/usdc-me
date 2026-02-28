"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import type { Intent } from "@/lib/api"
import * as api from "@/lib/api"

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function IntentRow({
  intent,
  direction,
}: {
  intent: Intent
  direction: "sent" | "received"
}) {
  const counterparty =
    direction === "sent" ? intent.to : intent.from
  const prefix = direction === "sent" ? "−" : "+"

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            {counterparty.slice(2, 4).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium leading-none">
            {truncate(counterparty)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {new Date(intent.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={
            direction === "received"
              ? "text-green-600 dark:text-green-400 text-sm font-semibold"
              : "text-sm font-semibold"
          }
        >
          {prefix}${intent.amount}
        </span>
        <StatusBadge status={intent.status} />
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="divide-y">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  )
}

interface TransactionListProps {
  userAddress: string
}

export function TransactionList({ userAddress }: TransactionListProps) {
  const [intents, setIntents] = useState<Intent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchIntents = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.getIntents()
      setIntents(data)
    } catch {
      // silently fail — not blocking
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntents()
  }, [fetchIntents])

  const received = intents.filter(
    (i) => i.to.toLowerCase() === userAddress.toLowerCase()
  )
  const sent = intents.filter(
    (i) => i.from.toLowerCase() === userAddress.toLowerCase()
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transactions</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchIntents}
            disabled={isLoading}
            aria-label="Refresh transactions"
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="received">
          <TabsList className="mb-4">
            <TabsTrigger value="received">
              Received{" "}
              {received.length > 0 && (
                <span className="ml-1 text-xs">({received.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent{" "}
              {sent.length > 0 && (
                <span className="ml-1 text-xs">({sent.length})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            {isLoading ? (
              <SkeletonRows />
            ) : received.length === 0 ? (
              <EmptyState label="No payments received yet — share your QR code!" />
            ) : (
              <ScrollArea className="h-64">
                <div className="divide-y">
                  {received.map((i) => (
                    <IntentRow key={i.id} intent={i} direction="received" />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {isLoading ? (
              <SkeletonRows />
            ) : sent.length === 0 ? (
              <EmptyState label="No payments sent yet." />
            ) : (
              <ScrollArea className="h-64">
                <div className="divide-y">
                  {sent.map((i) => (
                    <IntentRow key={i.id} intent={i} direction="sent" />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
