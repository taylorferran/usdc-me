"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import * as api from "@/lib/api"
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
}

export function PaymentForm({ handle }: PaymentFormProps) {
  const { user } = useAuth()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  })

  const { isSubmitting } = form.formState
  const amountValue = form.watch("amount")

  async function handleSubmit(values: FormValues) {
    setError(null)
    setSuccess(null)
    try {
      const res = await api.pay(handle, values.amount)
      const msg = res.new_balance
        ? `Paid @${handle} $${values.amount}! Your balance: $${res.new_balance}`
        : `Paid @${handle} $${values.amount}! Intent queued ✓`
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
      <div className="space-y-4 text-center">
        <div className="text-5xl">✅</div>
        <p className="font-medium">{success}</p>
        <Button variant="outline" onClick={() => setSuccess(null)} size="sm">
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

          {user ? (
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !amountValue}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2" />
                  Sending…
                </>
              ) : amountValue ? (
                `Pay $${amountValue} →`
              ) : (
                "Enter an amount"
              )}
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
