"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, WalletAdd01Icon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useAuth } from "@/contexts/auth-context"
import { deposit } from "@/lib/signing"
import type { Hex } from "viem"

export function AddFundsButton() {
  const { user, privateKey } = useAuth()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleDeposit() {
    if (!privateKey || !amount) return
    setIsLoading(true)
    try {
      const result = await deposit(privateKey as Hex, amount)
      toast.success(`Deposited ${amount} USDC to Gateway (tx: ${String(result.depositTxHash).slice(0, 10)}…)`)
      setAmount("")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed")
    } finally {
      setIsLoading(false)
    }
  }

  // If private key not in memory (session restored but not re-logged in), disable
  const canDeposit = !!user && !!privateKey

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <HugeiconsIcon icon={WalletAdd01Icon} strokeWidth={2} className="size-4 text-primary" />
          Add Funds
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Deposit to Gateway</DialogTitle>
          <DialogDescription>
            Move USDC from your wallet into the Gateway for instant x402 payments.
          </DialogDescription>
        </DialogHeader>

        {!canDeposit ? (
          <p className="text-muted-foreground text-sm">
            Please log out and log back in to unlock your wallet before depositing.
          </p>
        ) : (
          <div className="space-y-4">
            <InputGroup className="h-11">
              <InputGroupAddon>
                <InputGroupText>$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="text-sm font-medium">USDC</InputGroupText>
              </InputGroupAddon>
            </InputGroup>

            <Button
              className="w-full"
              onClick={handleDeposit}
              disabled={isLoading || !amount}
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Depositing…
                </>
              ) : (
                <>
                  Deposit to Gateway
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                </>

              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
