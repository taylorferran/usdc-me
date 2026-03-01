"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  WalletDone01Icon,
  ZapIcon,
  Globe02Icon,
  UserAdd01Icon,
  SignatureIcon,
  Layers01Icon,
  Store01Icon,
  Robot01Icon,
  ShieldKeyIcon,
  FingerPrintIcon,
  Key01Icon,
  CheckmarkCircle01Icon,
  Invoice01Icon,
  WebhookIcon,
  QrCode01Icon,
} from "@hugeicons/core-free-icons"
import { motion } from "motion/react"
import { useAuth } from "@/contexts/auth-context"
import HeroSection from "@/components/hero-section-demo-1"

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const features = [
  {
    icon: WalletDone01Icon,
    iconClass: "bg-blue-500/10 text-blue-500",
    title: "No wallet setup",
    description:
      "We create a smart wallet for you at sign up. No seed phrases, no extensions.",
  },
  {
    icon: ZapIcon,
    iconClass: "bg-amber-500/10 text-amber-500",
    title: "Zero gas fees",
    description:
      "Payments are x402 spend intents signed off-chain — gas is batched and covered by the network.",
  },
  {
    icon: Globe02Icon,
    iconClass: "bg-green-500/10 text-green-500",
    title: "Any chain, one handle",
    description:
      "Withdraw USDC to Arc, Base, Ethereum, Solana and 5 more chains from a single @handle.",
  },
]

const steps = [
  {
    number: "01",
    icon: UserAdd01Icon,
    title: "Create your handle",
    description:
      "Sign up with an email. We generate a smart wallet for you in-browser and encrypt your key with your password. We never see it.",
  },
  {
    number: "02",
    icon: SignatureIcon,
    title: "Sign a spend intent",
    description:
      "When you send USDC, your browser signs an EIP-712 message. No on-chain transaction, no gas, instant. The intent is queued.",
  },
  {
    number: "03",
    icon: Layers01Icon,
    title: "Intents settle in a batch",
    description:
      "All pending intents are batched into a single on-chain transaction by the Arc network. 10,000 payments. One gas fee.",
  },
]

const audiences = [
  {
    icon: UserAdd01Icon,
    iconClass: "bg-blue-500/10 text-blue-500",
    badge: "For users",
    badgeClass: "border-blue-500/30 text-blue-600 dark:text-blue-400",
    title: "Your personal payment link",
    description:
      "Get a handle like @yourname and share it anywhere. Anyone can pay you USDC instantly — no app install, no wallet required on their end.",
    bullets: [
      { icon: QrCode01Icon, text: "Shareable QR code & payment link" },
      { icon: Globe02Icon, text: "Withdraw to 9 chains from one place" },
      { icon: WalletDone01Icon, text: "No seed phrases, ever" },
    ],
  },
  {
    icon: Store01Icon,
    iconClass: "bg-purple-500/10 text-purple-500",
    badge: "For merchants",
    badgeClass: "border-purple-500/30 text-purple-600 dark:text-purple-400",
    title: "Accept USDC with one API call",
    description:
      "Register, get an API key, and start accepting USDC. Embed our payment widget on any site with a single script tag.",
    bullets: [
      { icon: Invoice01Icon, text: "POST /create → payment URL in seconds" },
      { icon: WebhookIcon, text: "Webhook callbacks on every payment" },
      { icon: CheckmarkCircle01Icon, text: "Embeddable widget, zero frontend work" },
    ],
  },
  {
    icon: Robot01Icon,
    iconClass: "bg-green-500/10 text-green-500",
    badge: "For AI agents",
    badgeClass: "border-green-500/30 text-green-600 dark:text-green-400",
    title: "Programmable micropayments",
    description:
      "The intent-based architecture is built for machine-speed payments. AI agents can pay per API call with no gas overhead on each interaction.",
    bullets: [
      { icon: ZapIcon, text: "Sub-cent payments that actually make sense" },
      { icon: Layers01Icon, text: "Batch thousands of payments into one tx" },
      { icon: Key01Icon, text: "Sign intents programmatically via Viem" },
    ],
  },
]

const securityFacts = [
  {
    icon: ShieldKeyIcon,
    title: "Zero-knowledge key storage",
    description:
      "Your private key is generated and encrypted in your browser using AES-GCM. The server only ever holds an encrypted blob — it cannot sign transactions on your behalf.",
  },
  {
    icon: FingerPrintIcon,
    title: "600,000-iteration PBKDF2",
    description:
      "Your encryption key is derived with 600,000 PBKDF2-SHA256 iterations. Brute-forcing the encrypted blob is computationally infeasible.",
  },
  {
    icon: Key01Icon,
    title: "Dual-password recovery",
    description:
      "Set a separate recovery password at sign-up. If you forget your login, you can re-encrypt your key without the server ever seeing it in plaintext.",
  },
]

const chains: Array<{ name: string; logo?: string; bg?: string; text?: string }> = [
  {
    name: "Arc",
    logo: "https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png",
  },
  {
    name: "Base",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  },
  {
    name: "Ethereum",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
  {
    name: "Solana",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  },
  {
    name: "Avalanche",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
  },
  {
    name: "Polygon",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  },
  {
    name: "Arbitrum",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  },
  {
    name: "Optimism",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  },
  {
    name: "Noble",
    logo: "https://framerusercontent.com/images/XdcD0abLVZF0aVw8YeT8rU7N9TE.png",
  },
]

const stats = [
  { value: "10,000 : 1", label: "Payments per gas fee" },
  { value: "< 1s", label: "Intent signing time" },
  { value: "9 chains", label: "Supported for withdrawal" },
  { value: "0 KYC", label: "No identity checks" },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center">
        <HeroSection />
      </section>

      {/* Stats bar */}
      <section className="border-y bg-muted/40">
        <FadeIn>
          <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center justify-center px-6 py-8 text-center">
                <span className="text-2xl font-bold tracking-tight sm:text-3xl">{s.value}</span>
                <span className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <FadeIn>
          <h2 className="mb-2 text-center text-2xl font-semibold">
            Payments, finally simple
          </h2>
          <p className="text-muted-foreground mb-8 text-center text-sm">
            Everything you hated about crypto payments — gone.
          </p>
        </FadeIn>
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.1}>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className={`inline-flex rounded-lg p-2.5 ${f.iconClass}`}>
                    <HugeiconsIcon icon={f.icon} strokeWidth={2} className="size-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.description}</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <Separator />

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <FadeIn>
          <h2 className="mb-2 text-center text-2xl font-semibold">How it works</h2>
          <p className="text-muted-foreground mb-10 text-center text-sm">
            From sign-up to settled — three steps, zero gas.
          </p>
        </FadeIn>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.12}>
            <div className="relative flex flex-col gap-4">
              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="bg-border absolute top-5 left-[calc(100%+0.75rem)] hidden h-px w-[calc(100%-1.5rem)] sm:block" />
              )}
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                  {step.number}
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <HugeiconsIcon icon={step.icon} strokeWidth={2} className="size-4" />
                </div>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <Separator />

      {/* Built for everyone */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <FadeIn>
          <h2 className="mb-2 text-center text-2xl font-semibold">Built for everyone</h2>
          <p className="text-muted-foreground mb-10 text-center text-sm">
            {"Whether you're a person, a business, or a bot — USDC.me works for you."}
          </p>
        </FadeIn>
        <div className="grid gap-6 lg:grid-cols-3">
          {audiences.map((a, i) => (
            <FadeIn key={a.badge} delay={i * 0.1}>
            <Card className="flex flex-col h-full">
              <CardContent className="flex flex-1 flex-col gap-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${a.iconClass}`}>
                    <HugeiconsIcon icon={a.icon} strokeWidth={2} className="size-5" />
                  </div>
                  <Badge variant="outline" className={a.badgeClass}>
                    {a.badge}
                  </Badge>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">{a.title}</h3>
                  <p className="text-muted-foreground text-sm">{a.description}</p>
                </div>
                <ul className="mt-auto space-y-2">
                  {a.bullets.map((b) => (
                    <li key={b.text} className="flex items-center gap-2 text-sm">
                      <HugeiconsIcon
                        icon={b.icon}
                        strokeWidth={2}
                        className="text-muted-foreground size-3.5 shrink-0"
                      />
                      {b.text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <Separator />

      {/* Security */}
      <section className="bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="mb-2 text-center text-2xl font-semibold">Security by design</h2>
            <p className="text-muted-foreground mb-10 text-center text-sm">
              Your keys, your money. We architect around the assumption that the server is&nbsp;compromised.
            </p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-3">
            {securityFacts.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.1}>
              <Card className="border-0 bg-background/60">
                <CardContent className="flex gap-4 pt-6">
                  <div className="bg-primary/10 text-primary mt-0.5 shrink-0 rounded-lg p-2">
                    <HugeiconsIcon icon={s.icon} strokeWidth={2} className="size-4" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{s.description}</p>
                  </div>
                </CardContent>
              </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Supported chains */}
      <section className="border-y bg-muted/30 px-6 py-12 lg:px-8">
        <FadeIn>
        <div className="mx-auto max-w-5xl">
          <p className="text-muted-foreground mb-8 text-center text-sm font-medium uppercase tracking-wide">
            Withdraw USDC to 9 chains
          </p>
          <div className="mx-auto grid max-w-lg grid-cols-3 items-center gap-x-8 gap-y-8 sm:max-w-2xl sm:grid-cols-5 sm:gap-x-10 lg:mx-0 lg:max-w-none lg:grid-cols-9">
            {chains.map((chain) => (
              <div key={chain.name} className="col-span-1 flex flex-col items-center gap-2">
                {chain.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={chain.name}
                    src={chain.logo}
                    width={48}
                    height={48}
                    className="h-10 w-10 rounded-full object-contain"
                  />
                ) : (
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${chain.bg} text-white`}
                  >
                    <span className="text-[9px] font-bold tracking-wide">
                      {chain.text}
                    </span>
                  </div>
                )}
                <span className="text-muted-foreground text-xs font-medium">{chain.name}</span>
              </div>
            ))}
          </div>
        </div>
        </FadeIn>
      </section>

      {/* CTA strip */}
      <section className="border-t bg-muted/30 px-4 py-16 text-center">
        <FadeIn>
        <Badge variant="outline" className="mb-4">
          Built at the Circle Hackathon 2026
        </Badge>
        <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to ditch gas fees forever?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">
          Sign up in 30 seconds. Your handle is waiting.
        </p>
        {!user ? (
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/register">
                Create your handle
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        ) : (
          <Button size="lg" className="gap-2" asChild>
            <Link href="/dashboard">
              Go to dashboard
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
            </Link>
          </Button>
        )}
        </FadeIn>
      </section>
    </div>
  )
}
