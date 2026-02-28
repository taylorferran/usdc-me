import webpush from "web-push"
import { supabaseAdmin } from "@/lib/server/supabase"

webpush.setVapidDetails(
  "mailto:noreply@usdc.me",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
}

/**
 * Send a push notification to all subscriptions registered for the given address(es).
 * Silently removes any expired/invalid subscriptions (410 Gone).
 */
export async function sendPushToAddress(addresses: string[], payload: PushPayload) {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_address", addresses)

  if (!subs || subs.length === 0) return

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
      icon: payload.icon ?? "/icons/icon-192.png",
    url: payload.url ?? "/dashboard",
  })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired; clean it up
        if (err && typeof err === "object" && "statusCode" in err && err.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
        }
      }
    })
  )
}
