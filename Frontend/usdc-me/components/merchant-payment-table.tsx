"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatUsdc } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MerchantPayment } from "@/lib/api"

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

interface MerchantPaymentTableProps {
  payments: MerchantPayment[]
  isLoading: boolean
}

export function MerchantPaymentTable({
  payments,
  isLoading,
}: MerchantPaymentTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Payment ID</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : payments.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground py-8 text-center text-sm"
              >
                No payments yet
              </TableCell>
            </TableRow>
          ) : (
            payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono text-xs cursor-default">
                        {p.id.length > 16
                          ? p.id.slice(0, 12) + "..."
                          : p.id}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{p.id}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">
                  {p.description ?? "\u2014"}
                </TableCell>
                <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                  ${formatUsdc(p.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell>
                  {p.payer_address ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-mono text-xs cursor-default">
                          {truncate(p.payer_address)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{p.payer_address}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {"\u2014"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
