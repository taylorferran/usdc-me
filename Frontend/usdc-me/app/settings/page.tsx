"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

const recoverySchema = z
  .object({
    currentRecoveryPassword: z.string().min(1, "Current recovery password is required"),
    newRecoveryPassword: z.string().min(8, "New recovery password must be at least 8 characters"),
    confirmRecoveryPassword: z.string().min(1, "Please confirm your new recovery password"),
  })
  .refine((data) => data.newRecoveryPassword === data.confirmRecoveryPassword, {
    message: "Passwords don't match",
    path: ["confirmRecoveryPassword"],
  })

type PasswordValues = z.infer<typeof passwordSchema>
type RecoveryValues = z.infer<typeof recoverySchema>

export default function SettingsPage() {
  const { user, isLoading, isUnlocked, changePassword, changeRecoveryPassword } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const recoveryForm = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      currentRecoveryPassword: "",
      newRecoveryPassword: "",
      confirmRecoveryPassword: "",
    },
  })

  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  async function handleChangePassword(values: PasswordValues) {
    setPasswordError(null)
    try {
      await changePassword(values.currentPassword, values.newPassword)
      toast.success("Password updated successfully")
      passwordForm.reset()
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password")
    }
  }

  async function handleChangeRecovery(values: RecoveryValues) {
    setRecoveryError(null)
    try {
      await changeRecoveryPassword(
        values.currentRecoveryPassword,
        values.newRecoveryPassword
      )
      toast.success("Recovery password updated successfully")
      recoveryForm.reset()
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "Failed to change recovery password")
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your password and recovery settings
        </p>
      </div>

      {!isUnlocked && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              Your wallet is locked. Log out and log back in to unlock your wallet before changing passwords.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
          <CardDescription>
            Update your login password. Your wallet key will be re-encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passwordError && (
            <p className="text-destructive mb-4 text-sm">{passwordError}</p>
          )}
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(handleChangePassword)}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={passwordForm.formState.isSubmitting || !isUnlocked}
              >
                {passwordForm.formState.isSubmitting ? (
                  <>
                    <Spinner className="mr-2" />
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Recovery Password</CardTitle>
          <CardDescription>
            Update the recovery password you use to restore your wallet if you forget your login password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recoveryError && (
            <p className="text-destructive mb-4 text-sm">{recoveryError}</p>
          )}
          <Form {...recoveryForm}>
            <form
              onSubmit={recoveryForm.handleSubmit(handleChangeRecovery)}
              className="space-y-4"
            >
              <FormField
                control={recoveryForm.control}
                name="currentRecoveryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Recovery Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={recoveryForm.control}
                name="newRecoveryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Recovery Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={recoveryForm.control}
                name="confirmRecoveryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Recovery Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-muted-foreground text-xs">
                      Write this down and store it safely.
                    </p>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={recoveryForm.formState.isSubmitting || !isUnlocked}
              >
                {recoveryForm.formState.isSubmitting ? (
                  <>
                    <Spinner className="mr-2" />
                    Updating…
                  </>
                ) : (
                  "Update recovery password"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
