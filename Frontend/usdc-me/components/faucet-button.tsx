"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { Hex } from "viem"

import { useAuth } from "@/contexts/auth-context"
import * as api from "@/lib/api"
import { deposit } from "@/lib/signing"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type Step = "idle" | "transferring" | "depositing" | "done"

const STEP_LABELS: Record<Step, string> = {
  idle: "Fund with 2 testnet USDC",
  transferring: "Sending USDC to wallet...",
  depositing: "Depositing to Gateway...",
  done: "Funded!",
}

export function FaucetButton() {
  const { user, privateKey } = useAuth()
  const [step, setStep] = useState<Step>("idle")

  const isWorking = step === "transferring" || step === "depositing"
  const canFund = !!user && !!privateKey && !isWorking

  async function handleFund() {
    if (!user || !privateKey) return
    try {
      // Step 1: Faucet sends USDC to user's wallet
      setStep("transferring")
      await api.faucetFund(user.address)

      // Step 2: Deposit from wallet into Gateway
      setStep("depositing")
      await deposit(privateKey as Hex, "2")

      setStep("done")
      toast.success("Funded! 2 USDC deposited to your Gateway balance.")
      setTimeout(() => setStep("idle"), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Funding failed"
      toast.error(msg)
      setStep("idle")
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleFund}
      disabled={!canFund}
      className="gap-2"
    >
      {isWorking && <Spinner className="size-3.5" />}
      {STEP_LABELS[step]}
    </Button>
  )
}
