const CACHE_NAME = "usdc-me-v1"

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
