"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { RegistrationProgress } from "@/components/registration-progress"

const schema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(20, "Handle must be 20 characters or less")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  recoveryPassword: z
    .string()
    .min(8, "Recovery password must be at least 8 characters"),
}).refine((data) => data.password !== data.recoveryPassword, {
  message: "Recovery password must be different from your login password",
  path: ["recoveryPassword"],
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const { register } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [progressStep, setProgressStep] = useState<0 | 1 | 2 | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { handle: "", email: "", password: "", recoveryPassword: "" },
  })

  const { isSubmitting } = form.formState
  const isLoading = isSubmitting || progressStep !== null

  async function handleSubmit(values: FormValues) {
    setError(null)
    setProgressStep(0)
    try {
      // Simulate the 3-step backend process visually
      await new Promise((r) => setTimeout(r, 900))
      setProgressStep(1)
      await new Promise((r) => setTimeout(r, 900))
      setProgressStep(2)
      await register(values.email, values.password, values.handle, values.recoveryPassword)
      const next = searchParams.get("next")
      router.push(next || `/dashboard?welcome=${encodeURIComponent(values.handle)}`)
    } catch (err) {
      setProgressStep(null)
      setError(err instanceof Error ? err.message : "Registration failed")
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create your handle</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Get a personal payment link — instant USDC, zero gas
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {error && (
              <Alert className="mb-4 border-destructive/50 text-destructive">
                {error}
              </Alert>
            )}

            {progressStep !== null ? (
              <RegistrationProgress step={progressStep} />
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Handle</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm">
                              @
                            </span>
                            <Input
                              placeholder="yourname"
                              className="pl-7"
                              autoCapitalize="none"
                              autoCorrect="off"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Min 8 characters"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recoveryPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recovery Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Different from login password"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-muted-foreground text-xs">
                          Write this down. If you forget your login password, this is your only way to recover your wallet.
                        </p>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner className="mr-2" />
                        Creating…
                      </>
                    ) : (
                      <>
                        Create my handle
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                      </>

                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
