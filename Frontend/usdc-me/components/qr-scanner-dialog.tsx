"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BrowserMultiFormatReader } from "@zxing/browser"
import { NotFoundException } from "@zxing/library"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { HugeiconsIcon } from "@hugeicons/react"
import { QrCodeScanIcon } from "@hugeicons/core-free-icons"

// ── Inner component — only mounts when dialog is open, so videoRef is always ready ──

interface ScannerViewProps {
  onScan: (text: string) => void
}

function ScannerView({ onScan }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    const reader = new BrowserMultiFormatReader()
    let stopped = false

    reader
      .decodeFromVideoDevice(
        undefined, // use default camera
        videoRef.current,
        (result, err) => {
          if (stopped) return

          if (result) {
            stopped = true
            BrowserMultiFormatReader.releaseAllStreams()
            onScan(result.getText())
            return
          }

          // NotFoundException fires every frame when no code is visible — suppress it
          if (err && !(err instanceof NotFoundException)) {
            setErrorMsg(err.message ?? "Camera error")
            setStatus("error")
          }
        }
      )
      .then(() => {
        if (!stopped) setStatus("scanning")
      })
      .catch((err: unknown) => {
        if (stopped) return
        const raw = err instanceof Error ? err.message : String(err)
        const msg = raw.toLowerCase().includes("permission")
          ? "Camera permission denied. Please allow camera access in your browser and try again."
          : raw.toLowerCase().includes("notfound") || raw.toLowerCase().includes("no camera")
          ? "No camera found on this device."
          : raw
        setErrorMsg(msg)
        setStatus("error")
      })

    return () => {
      stopped = true
      BrowserMultiFormatReader.releaseAllStreams()
    }
  }, [onScan])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Camera viewfinder */}
      <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-square">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />

        {/* Scanning overlay */}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative size-48">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-white/80" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-white/80" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-white/80" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-white/80" />
              <span className="absolute inset-x-0 top-0 h-0.5 animate-scan bg-linear-to-r from-transparent via-blue-400 to-transparent" />
            </div>
          </div>
        )}

        {/* Starting state */}
        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
            <Spinner className="size-8" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}
      </div>

      {status === "error" && errorMsg && (
        <p className="text-destructive text-center text-sm">{errorMsg}</p>
      )}

      {status === "scanning" && (
        <p className="text-muted-foreground text-xs text-center">
          Align the QR code within the frame
        </p>
      )}
    </div>
  )
}

// ── Main dialog ──

export function QrScannerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleScan(text: string) {
    const destination = extractDestination(text)
    if (destination) {
      setOpen(false)
      router.push(destination)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <HugeiconsIcon icon={QrCodeScanIcon} strokeWidth={2} className="size-4 text-primary" />
          Scan QR
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan a payment QR code</DialogTitle>
          <DialogDescription>
            Point your camera at a USDC-ME user QR code or a merchant payment QR code.
          </DialogDescription>
        </DialogHeader>

        {/* ScannerView only mounts when the dialog is open, so videoRef is always ready */}
        {open && <ScannerView onScan={handleScan} />}
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ──

/**
 * Resolves a scanned QR value to an internal navigation path.
 *
 * Handles:
 *  - Merchant payment URLs: https://usdc-me.xyz/pay/pay_abc123  → /pay/pay_abc123
 *  - User handle URLs:      https://usdc-me.xyz/alice           → /alice
 *  - Plain handles:         alice                               → /alice
 */
function extractDestination(text: string): string | null {
  text = text.trim()
  try {
    const url = new URL(text)
    const segments = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean)

    // Merchant payment: /pay/{paymentId}
    if (segments[0] === "pay" && segments[1]) {
      return `/pay/${segments[1]}`
    }

    // User handle: /{handle}
    const handle = segments[0]
    return handle && handle.length > 0 ? `/${handle}` : null
  } catch {
    // Plain handle string
    if (/^[a-zA-Z0-9_-]{1,30}$/.test(text)) return `/${text}`
    return null
  }
}
