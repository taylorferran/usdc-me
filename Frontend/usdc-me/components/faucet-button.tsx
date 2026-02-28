"use client"

import { useState } from "react"
import { toast } from "sonner"
import { type Hex, erc20Abi } from "viem"
import { createPublicClient, http } from "viem"

import { useAuth } from "@/contexts/auth-context"
import * as api from "@/lib/api"
import { deposit } from "@/lib/signing"
import { arcTestnet, ARC_USDC_ADDRESS } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type Step = "idle" | "transferring" | "confirming" | "depositing" | "done"

const STEP_LABELS: Record<Step, string> = {
  idle: "Fund with 2 testnet USDC",
  transferring: "Sending USDC to wallet...",
  confirming: "Confirming balance...",
  depositing: "Depositing to Gateway...",
  done: "Funded!",
}

/** Poll until the on-chain USDC balance is at least `minAmount` (atomic units). */
async function waitForBalance(
  address: `0x${string}`,
  minAmount: bigint,
  maxAttempts = 10
) {
  const client = createPublicClient({ chain: arcTestnet, transport: http() })
  for (let i = 0; i < maxAttempts; i++) {
    const bal = await client.readContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })
    if (bal >= minAmount) return
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error("Timed out waiting for USDC to arrive in wallet")
}

export function FaucetButton() {
  const { user, privateKey } = useAuth()
  const [step, setStep] = useState<Step>("idle")

  const isWorking =
    step === "transferring" || step === "confirming" || step === "depositing"
  const canFund = !!user && !!privateKey && !isWorking

  async function handleFund() {
    if (!user || !privateKey) return
    try {
      // Step 1: Faucet sends USDC to user's wallet
      setStep("transferring")
      await api.faucetFund(user.address)

      // Step 2: Wait for balance to be visible on-chain before depositing
      setStep("confirming")
      await waitForBalance(user.address as `0x${string}`, 2_000_000n) // 2 USDC in atomic

      // Step 3: Deposit from wallet into Gateway
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
