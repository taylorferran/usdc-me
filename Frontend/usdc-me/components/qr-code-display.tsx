"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons"

interface QRCodeDisplayProps {
  handle: string
}

export function QRCodeDisplay({ handle }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const payUrl = `${typeof window !== "undefined" ? window.location.origin : "https://usdc.me"}/@${handle}`

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, payUrl, {
        width: 180,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      })
    }
  }, [payUrl])

  async function handleCopy() {
    await navigator.clipboard.writeText(payUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your payment link</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <canvas
          ref={canvasRef}
          className="rounded-lg"
          aria-label={`QR code for ${payUrl}`}
        />
        <p className="text-muted-foreground font-mono text-sm">
          usdc.me/@{handle}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="size-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4" />
                  Copy link
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy your payment link</TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  )
}
