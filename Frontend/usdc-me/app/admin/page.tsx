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
  Sorting01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
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
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`rounded-full p-2.5 ${colorClass}`}>
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
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

export default function AdminPage() {
  const router = useRouter()
  const [intents, setIntents] = useState<Intent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSettling, setIsSettling] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [secondsLeft, setSecondsLeft] = useState(0)

  const nextSettleAtRef = useRef(0)
  const isAutoSettlingRef = useRef(false)
  const handleSettleRef = useRef<(() => Promise<void>) | undefined>(undefined)

  const fetchIntents = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/intents")
      if (!res.ok) throw new Error("Failed to fetch")
      const data: Intent[] = await res.json()
      setIntents(data)
    } catch {
      toast.error("Failed to load intents")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntents()
  }, [fetchIntents])

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
      await fetchIntents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed")
    } finally {
      setIsSettling(false)
    }
  }, [fetchIntents])

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

  const pending = intents.filter((i) => i.status === "pending").length
  const settled = intents.filter((i) => i.status === "settled").length
  const failed = intents.filter((i) => i.status === "failed").length

  const filtered = intents
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .sort((a, b) => {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} className="text-primary size-6" />
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">All spend intents across the platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-settle countdown */}
          <div className="text-muted-foreground flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm tabular-nums">
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
            <span>Auto-settle in</span>
            <span className={`font-mono font-medium ${secondsLeft <= 60 ? "text-amber-500" : "text-foreground"}`}>
              {formatCountdown(secondsLeft)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchIntents} disabled={isLoading} className="gap-2">
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleManualSettle}
            disabled={isSettling || pending === 0}
            className="gap-2"
          >
            {isSettling ? (
              <Spinner className="size-4" />
            ) : (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-4" />
            )}
            Settle Now {pending > 0 && `(${pending})`}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Intents"
          value={intents.length}
          icon={FilterIcon}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          label="Pending"
          value={pending}
          icon={Clock01Icon}
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <StatCard
          label="Settled"
          value={settled}
          icon={CheckmarkCircle01Icon}
          colorClass="bg-green-500/10 text-green-500"
        />
        <StatCard
          label="Failed"
          value={failed}
          icon={Cancel01Icon}
          colorClass="bg-red-500/10 text-red-500"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Intents</CardTitle>
            <CardDescription>
              {filtered.length} of {intents.length} total
            </CardDescription>
          </div>
          {/* Status filter */}
          <div className="flex gap-1">
            {(["all", "pending", "settled", "failed"] as StatusFilter[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "ghost"}
                className="capitalize"
                onClick={() => setStatusFilter(s)}
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
            <div className="overflow-x-auto">
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
                          <Badge
                            variant="outline"
                            className={STATUS_STYLES[intent.status] ?? ""}
                          >
                            {intent.status}
                          </Badge>
                          {intent.status === "failed" && intent.errorReason && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-600 focus:outline-none"
                                  aria-label="Failure reason"
                                >
                                  <HugeiconsIcon
                                    icon={Alert02Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md p-3"
                                arrowClassName="bg-popover fill-popover border-border"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-1">
                                  Failure reason
                                </p>
                                <p className="text-xs font-medium">
                                  {formatErrorReason(intent.errorReason)}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {intent.status === "failed" && !intent.errorReason && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground focus:outline-none"
                                  aria-label="No reason recorded"
                                >
                                  <HugeiconsIcon
                                    icon={Alert02Icon}
                                    strokeWidth={2}
                                    className="size-3.5 opacity-40"
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md p-3"
                                arrowClassName="bg-popover fill-popover border-border"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  No reason recorded
                                </p>
                                <p className="text-xs">
                                  Failed before error logging was added.
                                </p>
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
