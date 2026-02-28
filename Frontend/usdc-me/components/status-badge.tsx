import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Status = "pending" | "settled" | "failed" | "paid" | "expired"

interface StatusBadgeProps {
  status: Status
  className?: string
}

const STATUS_STYLES: Record<Status, string> = {
  settled: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  paid:    "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed:  "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  expired: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
}

const STATUS_LABELS: Record<Status, string> = {
  settled: "Settled",
  paid:    "Paid",
  pending: "Pending",
  failed:  "Failed",
  expired: "Expired",
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_STYLES[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}
