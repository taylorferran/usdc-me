"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import * as api from "@/lib/api"

export function AddFundsButton() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleAddFunds() {
    setIsLoading(true)
    try {
      await api.addFunds()
      toast.success("Added testnet USDC to your wallet!")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add funds"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleAddFunds}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? <Spinner /> : null}
      Add Funds
    </Button>
  )
}
