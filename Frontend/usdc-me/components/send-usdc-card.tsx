"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { isAddress } from "viem"
import type { Address, Hex } from "viem"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import * as api from "@/lib/api"

const schema = z.object({
  recipient: z
    .string()
    .min(1, "Recipient address is required")
    .refine((v) => isAddress(v), "Enter a valid 0x wallet address"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid amount (e.g. 1.5)")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0"),
})

type FormValues = z.infer<typeof schema>

export function SendUsdcCard() {
  const { user, privateKey } = useAuth()
  const [lastTx, setLastTx] = useState<{ amount: string; to: string } | null>(null)

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
      const amountAtomic = Math.round(parseFloat(values.amount) * 1e6).toString()

      const signedPayload = await signX402Payment(
        privateKey as Hex,
        values.recipient as Address,
        amountAtomic,
        ARC_CHAIN_ID
      )

      await api.sendSigned({
        from: user.address,
        to: values.recipient,
        amount: values.amount,
        signedPayload,
      })

      setLastTx({ amount: values.amount, to: values.recipient })
      toast.success(`Sent $${values.amount} USDC — intent queued ✓`)
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
                  <FormLabel>Recipient address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x..."
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
              Sent ${lastTx.amount} USDC
            </p>
            <p className="text-muted-foreground font-mono text-xs mt-0.5 break-all">
              → {lastTx.to}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
