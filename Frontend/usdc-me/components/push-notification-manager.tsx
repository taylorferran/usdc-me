"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Notification01Icon, NotificationOff01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export function PushNotificationManager() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkSubscription = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setSubscription(sub)
  }, [])

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      setIsSupported(true)
      checkSubscription()
    }
  }, [checkSubscription])

  async function handleSubscribe() {
    if (!user?.address) {
      toast.error("Please log in first")
      return
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      toast.error("Push notifications not configured")
      return
    }

    setIsLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        toast.error("Notification permission denied")
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userAddress: user.address }),
      })

      if (!res.ok) throw new Error("Failed to save subscription")

      setSubscription(sub)
      toast.success("Payment notifications enabled!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to subscribe")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUnsubscribe() {
    if (!subscription) return
    setIsLoading(true)
    try {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
      setSubscription(null)
      toast.info("Notifications disabled")
    } catch {
      toast.error("Failed to unsubscribe")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) return null

  const isSubscribed = !!subscription

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={isLoading}
      className="gap-2"
      title={isSubscribed ? "Disable notifications" : "Enable payment notifications"}
    >
      {isLoading ? (
        <Spinner className="size-4" />
      ) : (
        <HugeiconsIcon
          icon={isSubscribed ? NotificationOff01Icon : Notification01Icon}
          strokeWidth={2}
          className="size-4"
        />
      )}
      {isSubscribed ? "Notifications on" : "Notify me"}
    </Button>
  )
}
