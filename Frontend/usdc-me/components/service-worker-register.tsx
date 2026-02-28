"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // A new version is available — you could show a toast here if wanted
              console.info("[SW] New version available. Reload to update.")
            }
          })
        })
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err)
      })
  }, [])

  return null
}
