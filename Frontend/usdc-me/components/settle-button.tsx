"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import * as api from "@/lib/api"
import { formatUsdc } from "@/lib/format"

export function SettleButton() {
  const [isSettling, setIsSettling] = useState(false)

  async function handleSettle() {
    setIsSettling(true)
    try {
      const res = await api.settle()
      if (res.settled === 0) {
        toast.info("No pending intents to settle.")
      } else {
        toast.success(
          `${res.settled} intent${res.settled !== 1 ? "s" : ""} → 1 tx on Arc ✓ ($${formatUsdc(res.totalAmount)} USDC)`
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed")
    } finally {
      setIsSettling(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" disabled={isSettling} className="gap-2">
          {isSettling ? <Spinner /> : null}
          Settle Now
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Settle pending payments?</AlertDialogTitle>
          <AlertDialogDescription>
            This will batch all pending x402 spend intents into a single
            on-chain transaction on Arc. Gas is handled by the Gateway.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSettle}>
            Settle now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
