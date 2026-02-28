"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Alert } from "@/components/ui/alert"

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  recoveryPassword: z.string().min(1, "Recovery password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})

type FormValues = z.infer<typeof schema>

export default function RecoverPage() {
  return (
    <Suspense>
      <RecoverForm />
    </Suspense>
  )
}

function RecoverForm() {
  const { recover, recoverWithPassword, needsRecovery, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isRekeyMode = searchParams.get("mode") === "rekey"
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      recoveryPassword: "",
      newPassword: "",
    },
  })

  const { isSubmitting } = form.formState

  async function handleSubmit(values: FormValues) {
    setError(null)
    try {
      if (isRekeyMode && needsRecovery) {
        // Already authenticated — just need to re-encrypt the key
        await recoverWithPassword(values.recoveryPassword, values.newPassword)
      } else {
        // Not authenticated — full recovery via backend
        await recover(values.email, values.recoveryPassword, values.newPassword)
      }
      toast.success("Wallet recovered! Your password has been updated.")
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed")
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Recover your wallet</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isRekeyMode
              ? "Your login password changed. Enter your recovery password to restore access."
              : "Enter your email and the recovery password you saved during registration."}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {error && (
              <Alert className="mb-4 border-destructive/50 text-destructive">
                {error}
              </Alert>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                {!(isRekeyMode && needsRecovery) && (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="recoveryPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recovery Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="The recovery password you saved"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Min 8 characters"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-muted-foreground text-xs">
                        This will become your new login password.
                      </p>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2" />
                      Recovering…
                    </>
                  ) : (
                    "Recover wallet"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-sm">
          Remember your password?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
