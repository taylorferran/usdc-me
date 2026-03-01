"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { CanvasText } from "@/components/ui/canvas-text"
import { useAuth } from "@/contexts/auth-context"

const CANVAS_COLORS = [
  "rgba(39, 117, 202, 1)",
  "rgba(39, 117, 202, 0.85)",
  "rgba(0, 163, 255, 0.9)",
  "rgba(0, 200, 180, 0.85)",
  "rgba(0, 200, 180, 0.7)",
  "rgba(39, 117, 202, 0.6)",
  "rgba(0, 163, 255, 0.5)",
  "rgba(39, 117, 202, 0.4)",
  "rgba(0, 200, 180, 0.3)",
  "rgba(39, 117, 202, 0.2)",
]

// [word, delay in seconds]
const line1: [string, number][] = [
  ["One", 0],
  ["handle.", 0.1],
]
const line2Delay = 0.25
const line3: [string, number][] = [
  ["Zero", 0.45],
  ["gas.", 0.55],
]
const subtitleDelay = 0.75
const buttonsDelay = 0.95

function AnimatedWord({ word, delay }: { word: string; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeInOut" }}
      className="mr-2 inline-block"
    >
      {word}
    </motion.span>
  )
}

export default function HeroSection() {
  const { user } = useAuth()

  return (
    <div className="relative w-full py-16 md:py-28">
      {/* Left border decoration */}
      <div className="absolute inset-y-0 left-0 h-full w-px bg-neutral-300 dark:bg-neutral-700">
        <div className="absolute top-0 h-40 w-px bg-linear-to-b from-transparent via-blue-500 to-transparent" />
      </div>
      {/* Right border decoration */}
      <div className="absolute inset-y-0 right-0 h-full w-px bg-neutral-300 dark:bg-neutral-700">
        <div className="absolute top-0 h-40 w-px bg-linear-to-b from-transparent via-blue-500 to-transparent" />
      </div>
      {/* Bottom border decoration */}
      <div className="absolute inset-x-0 bottom-0 h-px w-full bg-neutral-300 dark:bg-neutral-700">
        <div className="absolute mx-auto h-px w-40 bg-linear-to-r from-transparent via-blue-500 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-6 md:px-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="mb-6 flex justify-center"
        >
          <Badge variant="outline">Powered by Circle x402 on Arc</Badge>
        </motion.div>

        {/* Heading */}
        <h1 className="relative z-10 text-center text-4xl font-bold tracking-tight text-slate-700 sm:text-5xl md:text-6xl lg:text-7xl dark:text-slate-300">
          {/* Line 1: "One handle." */}
          <span className="block">
            {line1.map(([word, delay]) => (
              <AnimatedWord key={word} word={word} delay={delay} />
            ))}
          </span>

          {/* Line 2: CanvasText "Instant USDC." */}
          <motion.span
            initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.3, delay: line2Delay, ease: "easeInOut" }}
            className="block"
          >
            <CanvasText
              text="Instant USDC."
              backgroundClassName="bg-blue-600 dark:bg-blue-700"
              colors={CANVAS_COLORS}
              lineGap={5}
              animationDuration={18}
            />
          </motion.span>

          {/* Line 3: "Zero gas." */}
          <span className="block">
            {line3.map(([word, delay]) => (
              <AnimatedWord key={word} word={word} delay={delay} />
            ))}
          </span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: subtitleDelay }}
          className="relative z-10 mx-auto mt-6 max-w-xl text-center text-lg text-neutral-600 dark:text-neutral-400"
        >
          Create your personal payment link and start receiving USDC in seconds.
          No wallets, no complexity — just{" "}
          <span className="font-medium text-foreground">usdc-me.xyz/@you</span>.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: buttonsDelay }}
          className="relative z-10 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          {!user ? (
            <>
              <Button size="lg" className="w-full gap-2 sm:w-auto" asChild>
                <Link href="/register">
                  Create your handle
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </>
          ) : (
            <Button size="lg" className="gap-2" asChild>
              <Link href="/dashboard">
                Go to dashboard
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
              </Link>
            </Button>
          )}
        </motion.div>

        {/* Demo link */}
        {!user && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: buttonsDelay + 0.15 }}
            className="relative z-10 mt-4 text-center text-sm text-muted-foreground"
          >
            Already have a link? Try{" "}
            <Link href="/demo" className="text-primary hover:underline">
              usdc-me.xyz/@demo
            </Link>
          </motion.p>
        )}
      </div>
    </div>
  )
}
