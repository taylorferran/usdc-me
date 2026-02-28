import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: "pending" | "settled"
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "settled"
          ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className
      )}
    >
      {status === "settled" ? "Settled" : "Pending"}
    </Badge>
  )
}
