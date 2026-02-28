"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import type { Address, Hex } from "viem"

import * as api from "@/lib/api"
import { signX402Payment } from "@/lib/signing"
import { ARC_CHAIN_ID } from "@/lib/wallet"
import { useAuth } from "@/contexts/auth-context"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert } from "@/components/ui/alert"
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group"

const schema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0"),
})

type FormValues = z.infer<typeof schema>

interface PaymentFormProps {
  handle: string
  recipientAddress: string
}

export function PaymentForm({ handle, recipientAddress }: PaymentFormProps) {
  const { user, privateKey } = useAuth()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  })

  const { isSubmitting } = form.formState
  const amountValue = form.watch("amount")

  async function handleSubmit(values: FormValues) {
    if (!user || !privateKey) return
    setError(null)
    setSuccess(null)

    try {
      const amountAtomic = Math.round(parseFloat(values.amount) * 1e6).toString()

      // Sign the x402 payment payload in the browser
      const signedPayload = await signX402Payment(
        privateKey as Hex,
        recipientAddress as Address,
        amountAtomic,
        ARC_CHAIN_ID
      )

      // Send pre-signed payload to backend for verification + queuing
      await api.sendSigned({
        from: user.address,
        to: recipientAddress,
        amount: values.amount,
        signedPayload,
      })

      const msg = `Paid @${handle} $${values.amount}`
      setSuccess(msg)
      toast.success(msg)
      form.reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed"
      setError(msg)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="animate-in zoom-in-50 fade-in duration-300 rounded-full bg-green-500/10 p-4">
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            strokeWidth={1.5}
            className="size-12 text-green-500"
          />
        </div>
        <p className="animate-in fade-in slide-in-from-bottom-2 duration-300 font-medium">
          {success}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSuccess(null)}
          className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          Make another payment
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert className="border-destructive/50 text-destructive text-sm">
          {error}
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <InputGroup className="h-12 text-lg">
                    <InputGroupAddon>
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="text-lg"
                      {...field}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText className="text-sm font-medium">
                        USDC
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {user && privateKey ? (
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !amountValue}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2" />
                  Signing…
                </>
              ) : amountValue ? (
                `Pay $${amountValue} →`
              ) : (
                "Enter an amount"
              )}
            </Button>
          ) : user && !privateKey ? (
            // Session restored from Supabase but key not yet decrypted —
            // redirect to login to re-enter password
            <Button className="w-full" size="lg" asChild>
              <Link href={`/login?next=/${handle}`}>
                Re-enter password to pay
              </Link>
            </Button>
          ) : (
            <Button className="w-full" size="lg" asChild>
              <Link href={`/register?next=/${handle}`}>
                Sign up to pay @{handle}
              </Link>
            </Button>
          )}
        </form>
      </Form>

      {!user && (
        <p className="text-muted-foreground text-center text-xs">
          Already have an account?{" "}
          <Link
            href={`/login?next=/${handle}`}
            className="text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      )}
    </div>
  )
}
