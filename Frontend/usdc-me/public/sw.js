const CACHE_NAME = "usdc-me-v2"

// Core app shell — cached on install
const APP_SHELL = ["/", "/dashboard", "/manifest.webmanifest"]

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event

  // Only handle GET requests
  if (request.method !== "GET") return

  const url = new URL(request.url)

  // Skip cross-origin requests (Supabase, fonts, etc.)
  if (url.origin !== self.location.origin) return

  // Never cache API calls or admin routes — always go to network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) {
    event.respondWith(fetch(request))
    return
  }

  // Navigation requests (HTML pages): network-first, fall back to cached version
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match("/"))
        )
    )
    return
  }

  // Static assets (JS, CSS, images, fonts): cache-first, update in background
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })

      // Return cached immediately if we have it, but still refresh
      return cached ?? networkFetch
    })
  )
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon ?? "/icons/icon.svg",
      badge: "/icons/icon.svg",
      vibrate: [100, 50, 100],
      data: { url: data.url ?? "/dashboard" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? "/dashboard"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing window if one is already open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        // Otherwise open a new window
        return clients.openWindow(url)
      })
  )
})
