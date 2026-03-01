"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  RefreshIcon,
  Logout01Icon,
  SecurityCheckIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Cancel01Icon,
  FilterIcon,
  Alert02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getIntentsPaginated } from "@/lib/api"
import type { Intent } from "@/lib/api"
import { formatUsdc } from "@/lib/format"

// Returns the timestamp of the next :00 or :30 on the clock
function getNextSettleAt(): number {
  const now = new Date()
  const next = new Date(now)
  if (now.getMinutes() < 30) {
    next.setMinutes(30, 0, 0)
  } else {
    next.setHours(now.getHours() + 1, 0, 0, 0)
  }
  return next.getTime()
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

type SortField = "timestamp" | "amount" | "status"
type SortDir = "asc" | "desc"
type StatusFilter = "all" | "pending" | "settled" | "failed"

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`
}

function formatErrorReason(reason: string) {
  return reason
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Returns an array of page numbers and "ellipsis" markers for the pagination bar. */
function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "ellipsis")[] = [1]

  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)

  if (left > 2) pages.push("ellipsis")
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total - 1) pages.push("ellipsis")

  pages.push(total)
  return pages
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function StatCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string
  value: number | string
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  colorClass: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:pt-6">
        <div className={`shrink-0 rounded-full p-2 sm:p-2.5 ${colorClass}`}>
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs sm:text-sm">{label}</p>
          <p className="text-xl font-bold sm:text-2xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

const STATUS_STYLES: Record<string, string> = {
  settled: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
}

const PAGE_SIZE = 200

export default function AdminPage() {
  const router = useRouter()
  const [intents, setIntents] = useState<Intent[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ total: 0, pending: 0, settled: 0, failed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSettling, setIsSettling] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Refs so realtime callback always reads current values without re-subscribing
  const pageRef = useRef(page)
  pageRef.current = page
  const statusFilterRef = useRef(statusFilter)
  statusFilterRef.current = statusFilter

  const nextSettleAtRef = useRef(0)
  const isAutoSettlingRef = useRef(false)
  const handleSettleRef = useRef<(() => Promise<void>) | undefined>(undefined)

  const fetchIntents = useCallback(async (targetPage?: number, silent = false) => {
    const p = targetPage ?? pageRef.current
    if (!silent) setIsLoading(true)
    try {
      const result = await getIntentsPaginated({
        status: statusFilterRef.current === "all" ? undefined : statusFilterRef.current,
        page: p,
        limit: PAGE_SIZE,
      })
      setIntents(result.data)
      setTotalCount(result.total)
      setTotalPages(result.totalPages)
    } catch {
      if (!silent) toast.error("Failed to load intents")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  // Fetch overall counts for stat cards (unfiltered)
  const fetchStats = useCallback(async () => {
    try {
      const [all, pending, settled, failed] = await Promise.all([
        getIntentsPaginated({ limit: 1 }),
        getIntentsPaginated({ status: "pending", limit: 1 }),
        getIntentsPaginated({ status: "settled", limit: 1 }),
        getIntentsPaginated({ status: "failed", limit: 1 }),
      ])
      setStats({
        total: all.total,
        pending: pending.total,
        settled: settled.total,
        failed: failed.total,
      })
    } catch {
      // silently fail — stat cards are non-critical
    }
  }, [])

  // Reset to page 1 when filter changes, then fetch
  useEffect(() => {
    setPage(1)
    fetchIntents(1)
  }, [statusFilter, fetchIntents])

  // Fetch when page changes (but not on filter change — handled above)
  useEffect(() => {
    fetchIntents(page)
  }, [page, fetchIntents])

  // Stats on mount
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Supabase Realtime — watch all transaction changes platform-wide
  useEffect(() => {
    const channel = supabase
      .channel("admin-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          fetchIntents(undefined, true)
          fetchStats()
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
      setIsLive(false)
    }
  }, [fetchIntents, fetchStats])

  const handleSettle = useCallback(async () => {
    setIsSettling(true)
    try {
      const res = await fetch("/api/settle", { method: "POST" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Settle failed")
      if (body.message === "No pending intents to settle") {
        toast.info("No pending intents found to settle")
      } else if ((body.settled ?? 0) === 0 && (body.failed ?? 0) > 0) {
        const reasons = (body.results as Array<{ error?: string }>)
          ?.filter((r) => r.error)
          .map((r) => r.error)
          .join("; ")
        toast.error(`All ${body.failed} settlement(s) failed${reasons ? `: ${reasons}` : ""}`)
      } else {
        const msg = body.failed > 0
          ? `Settled ${body.settled} intent(s), ${body.failed} failed`
          : `Settled ${body.settled} intent(s)`
        toast.success(msg)
      }
      await Promise.all([fetchIntents(page, false), fetchStats()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed")
    } finally {
      setIsSettling(false)
    }
  }, [fetchIntents, fetchStats, page])

  // Keep ref in sync so the interval can always call the latest version
  useEffect(() => {
    handleSettleRef.current = handleSettle
  }, [handleSettle])

  // Auto-settle countdown — runs once on mount
  useEffect(() => {
    // Initialise client-side only to avoid SSR/hydration mismatch
    nextSettleAtRef.current = getNextSettleAt()
    setSecondsLeft(Math.round((nextSettleAtRef.current - Date.now()) / 1000))

    const id = setInterval(async () => {
      const remaining = Math.max(0, Math.round((nextSettleAtRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)

      if (remaining <= 0 && !isAutoSettlingRef.current) {
        isAutoSettlingRef.current = true
        toast.info("Auto-settling pending intents…")
        await handleSettleRef.current?.()
        nextSettleAtRef.current = getNextSettleAt()
        setSecondsLeft(Math.round((nextSettleAtRef.current - Date.now()) / 1000))
        isAutoSettlingRef.current = false
      }
    }, 1000)

    return () => clearInterval(id)
  }, [])

  function resetSettleTimer() {
    nextSettleAtRef.current = getNextSettleAt()
    setSecondsLeft(Math.round((nextSettleAtRef.current - Date.now()) / 1000))
  }

  async function handleManualSettle() {
    await handleSettle()
    resetSettleTimer()
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" })
    router.push("/admin/login")
    router.refresh()
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  // Client-side sort within the current page
  const filtered = intents.sort((a, b) => {
      let cmp = 0
      if (sortField === "timestamp") cmp = a.timestamp.localeCompare(b.timestamp)
      if (sortField === "amount") cmp = Number(a.amount) - Number(b.amount)
      if (sortField === "status") cmp = a.status.localeCompare(b.status)
      return sortDir === "asc" ? cmp : -cmp
    })

  const SortIcon = ({ field }: { field: SortField }) => (
    <HugeiconsIcon
      icon={sortField === field ? (sortDir === "asc" ? ArrowUp01Icon : ArrowDown01Icon) : Sorting01Icon}
      strokeWidth={2}
      className="ml-1 inline-block size-3 text-muted-foreground"
    />
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} className="text-primary size-6 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              {isLive && (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">All spend intents across the platform</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-settle countdown — label hidden on mobile to save space */}
          <div className="text-muted-foreground flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm tabular-nums">
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Auto-settle in</span>
            <span className={`font-mono font-medium ${secondsLeft <= 60 ? "text-amber-500" : "text-foreground"}`}>
              {formatCountdown(secondsLeft)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { fetchIntents(page, false); fetchStats() }} disabled={isLoading} className="gap-2">
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className={`size-4 text-primary ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleManualSettle}
            disabled={isSettling || stats.pending === 0}
            className="gap-2"
          >
            {isSettling ? (
              <Spinner className="size-4" />
            ) : (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-4" />
            )}
            Settle Now {stats.pending > 0 && `(${stats.pending})`}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Intents"
          value={stats.total}
          icon={FilterIcon}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock01Icon}
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <StatCard
          label="Settled"
          value={stats.settled}
          icon={CheckmarkCircle01Icon}
          colorClass="bg-green-500/10 text-green-500"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={Cancel01Icon}
          colorClass="bg-red-500/10 text-red-500"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Intents</CardTitle>
            <CardDescription>
              {totalCount === 0 ? "No intents" : `${((page - 1) * PAGE_SIZE) + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
            </CardDescription>
          </div>
          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            {(["all", "pending", "settled", "failed"] as StatusFilter[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "ghost"}
                className="capitalize"
                onClick={() => { setStatusFilter(s as StatusFilter) }}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
              No intents found
            </div>
          ) : (
            <>
              {/* ── Mobile card list (hidden sm+) ── */}
              <div className="divide-y sm:hidden">
                {filtered.map((intent) => (
                  <div key={intent.id} className="space-y-2 px-4 py-3">
                    {/* Row 1: ID + status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {intent.id.slice(0, 8)}…
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={STATUS_STYLES[intent.status] ?? ""}>
                          {intent.status}
                        </Badge>
                        {intent.status === "failed" && intent.errorReason && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-red-500 hover:text-red-600 focus:outline-none" aria-label="Failure reason">
                                <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md p-3" arrowClassName="bg-popover fill-popover border-border">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-1">Failure reason</p>
                              <p className="text-xs font-medium">{formatErrorReason(intent.errorReason)}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    {/* Row 2: From → To */}
                    <div className="flex min-w-0 items-center gap-1 font-mono text-xs">
                      <span className="truncate text-muted-foreground">{truncate(intent.from)}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{truncate(intent.to)}</span>
                    </div>
                    {/* Row 3: Amount + date */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{formatUsdc(intent.amount)} USDC</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(intent.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table (hidden below sm) ── */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">ID</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("amount")}
                      >
                        Amount
                        <SortIcon field="amount" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("status")}
                      >
                        Status
                        <SortIcon field="status" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("timestamp")}
                      >
                        Date
                        <SortIcon field="timestamp" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((intent) => (
                      <TableRow key={intent.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {intent.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="font-mono text-xs">{truncate(intent.from)}</TableCell>
                        <TableCell className="font-mono text-xs">{truncate(intent.to)}</TableCell>
                        <TableCell className="font-medium">
                          {formatUsdc(intent.amount)} USDC
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={STATUS_STYLES[intent.status] ?? ""}>
                              {intent.status}
                            </Badge>
                            {intent.status === "failed" && intent.errorReason && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="text-red-500 hover:text-red-600 focus:outline-none" aria-label="Failure reason">
                                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md p-3" arrowClassName="bg-popover fill-popover border-border">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-1">Failure reason</p>
                                  <p className="text-xs font-medium">{formatErrorReason(intent.errorReason)}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {intent.status === "failed" && !intent.errorReason && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="No reason recorded">
                                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5 opacity-40" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md p-3" arrowClassName="bg-popover fill-popover border-border">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">No reason recorded</p>
                                  <p className="text-xs">Failed before error logging was added.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(intent.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t px-6 py-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => { e.preventDefault(); if (page > 1) setPage((p) => p - 1) }}
                      aria-disabled={page === 1 || isLoading}
                      className={page === 1 || isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {buildPageNumbers(page, totalPages).map((item, i) =>
                    item === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={item === page}
                          onClick={(e) => { e.preventDefault(); setPage(item) }}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage((p) => p + 1) }}
                      aria-disabled={page === totalPages || isLoading}
                      className={page === totalPages || isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
