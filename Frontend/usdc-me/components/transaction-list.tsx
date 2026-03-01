"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import { supabase } from "@/lib/supabase"
import { formatUsdc } from "@/lib/format"

interface Transaction {
  id: string
  type: "send" | "deposit" | "withdraw"
  from_address: string
  to_address: string
  amount: string
  status: "pending" | "settled" | "failed"
  tx_hash: string | null
  network: string
  created_at: string
}

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function TransactionRow({
  tx,
  direction,
}: {
  tx: Transaction
  direction: "sent" | "received"
}) {
  const counterparty = direction === "sent" ? tx.to_address : tx.from_address
  const prefix = direction === "sent" ? "−" : "+"
  const label = tx.type === "withdraw" ? "Withdraw" : direction === "sent" ? "Sent" : "Received"

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            {counterparty ? counterparty.slice(2, 4).toUpperCase() : "??"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium leading-none">
            {counterparty ? truncate(counterparty) : label}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {new Date(tx.created_at).toLocaleString()}
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
          {prefix}${formatUsdc(tx.amount)}
        </span>
        <StatusBadge status={tx.status} />
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="h-64 divide-y overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const userAddressRef = useRef(userAddress)
  userAddressRef.current = userAddress

  const fetchTransactions = useCallback(async (silent = false) => {
    if (!userAddressRef.current) return
    if (!silent) setIsLoading(true)
    try {
      const { data } = await supabase
        .from("transactions")
        .select("id, type, from_address, to_address, amount, status, tx_hash, network, created_at")
        .or(`from_address.eq.${userAddressRef.current},to_address.eq.${userAddressRef.current}`)
        .order("created_at", { ascending: false })
        .limit(50)

      setTransactions((data as Transaction[]) ?? [])
    } catch {
      // silently fail
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions, userAddress])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!userAddress) return

    const channel = supabase
      .channel(`transactions-list:${userAddress}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<Transaction> | null
          const addr = userAddressRef.current.toLowerCase()
          if (
            row?.from_address?.toLowerCase() === addr ||
            row?.to_address?.toLowerCase() === addr
          ) {
            fetchTransactions(true)
          }
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
      setIsLive(false)
    }
  }, [userAddress, fetchTransactions])

  const addr = userAddress.toLowerCase()
  const received = transactions.filter(
    (t) => t.type === "send" && t.to_address?.toLowerCase() === addr
  )
  const sent = transactions.filter(
    (t) => t.from_address?.toLowerCase() === addr
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Transactions</CardTitle>
            {isLive && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fetchTransactions()}
            disabled={isLoading}
            aria-label="Refresh transactions"
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4 text-primary" />
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
                <div className="divide-y pr-3">
                  {received.map((t) => (
                    <TransactionRow key={t.id} tx={t} direction="received" />
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
                <div className="divide-y pr-3">
                  {sent.map((t) => (
                    <TransactionRow key={t.id} tx={t} direction="sent" />
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
