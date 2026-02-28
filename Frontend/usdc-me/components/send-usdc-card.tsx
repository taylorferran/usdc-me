"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { isAddress } from "viem"
import type { Address, Hex } from "viem"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useAuth } from "@/contexts/auth-context"
import { signX402Payment } from "@/lib/signing"
import { ARC_CHAIN_ID } from "@/lib/wallet"
import { supabase } from "@/lib/supabase"
import * as api from "@/lib/api"

const HANDLE_REGEX = /^@?[a-zA-Z0-9_]{1,30}$/

const schema = z.object({
  recipient: z
    .string()
    .min(1, "Recipient is required")
    .refine(
      (v) => isAddress(v) || HANDLE_REGEX.test(v),
      "Enter a valid @handle or 0x address"
    ),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid amount (e.g. 1.5)")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0"),
})

type FormValues = z.infer<typeof schema>

/** Resolve a @handle to a wallet address, or return the address as-is. */
async function resolveRecipient(
  input: string
): Promise<{ address: Address; handle?: string }> {
  if (isAddress(input)) return { address: input as Address }

  const handle = input.replace(/^@/, "")
  const { data, error } = await supabase
    .from("profiles")
    .select("handle, wallet_address")
    .eq("handle", handle)
    .single()

  if (error || !data?.wallet_address) {
    throw new Error(`User @${handle} not found`)
  }

  return { address: data.wallet_address as Address, handle: data.handle }
}

export function SendUsdcCard() {
  const { user, privateKey } = useAuth()
  const [lastTx, setLastTx] = useState<{ amount: string; to: string; handle?: string } | null>(null)

  const form = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { recipient: "", amount: "" },
  })

  const { isSubmitting } = form.formState
  const isUnlocked = !!user && !!privateKey

  async function handleSubmit(values: FormValues) {
    if (!user || !privateKey) return
    setLastTx(null)

    try {
      // Resolve @handle → wallet address if needed
      const resolved = await resolveRecipient(values.recipient)
      const amountAtomic = Math.round(parseFloat(values.amount) * 1e6).toString()

      const signedPayload = await signX402Payment(
        privateKey as Hex,
        resolved.address,
        amountAtomic,
        ARC_CHAIN_ID
      )

      await api.sendSigned({
        from: user.address,
        to: resolved.address,
        amount: values.amount,
        signedPayload,
      })

      setLastTx({ amount: values.amount, to: resolved.address, handle: resolved.handle })
      const recipientLabel = resolved.handle ? `@${resolved.handle}` : resolved.address.slice(0, 10) + "…"
      toast.success(`Sent $${values.amount} USDC to ${recipientLabel} — intent queued`)
      form.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send USDC (x402)</CardTitle>
        <CardDescription>
          Signs an x402 spend intent in your browser (instant, gasless)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@handle or 0x..."
                      spellCheck={false}
                      autoComplete="off"
                      disabled={!isUnlocked || isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        type="number"
                        step="0.000001"
                        min="0.000001"
                        placeholder="0.00"
                        disabled={!isUnlocked || isSubmitting}
                        {...field}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText className="text-sm font-medium">USDC</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isUnlocked ? (
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner className="size-4" />
                    Signing…
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            ) : (
              <Button type="button" className="w-full" disabled>
                Log out and back in to unlock wallet
              </Button>
            )}
          </form>
        </Form>

        {lastTx && (
          <div className="bg-muted/50 mt-4 rounded-lg border p-3 text-sm">
            <p className="font-medium text-green-600 dark:text-green-400">
              Sent ${lastTx.amount} USDC{lastTx.handle ? ` to @${lastTx.handle}` : ""}
            </p>
            <p className="text-muted-foreground font-mono text-xs mt-0.5 break-all flex items-center gap-1">
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3 shrink-0" />
              {lastTx.to}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
