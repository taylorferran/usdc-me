import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const features = [
  {
    title: "No wallet setup",
    description:
      "We create a smart wallet for you at sign up. No seed phrases, no extensions.",
  },
  {
    title: "Zero gas fees",
    description:
      "Payments are x402 spend intents signed off-chain — gas is batched and covered by the network.",
  },
  {
    title: "Any chain, one handle",
    description:
      "Withdraw USDC to Arc, Base, Ethereum, Solana and 5 more chains from a single @handle.",
  },
]

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <Badge variant="outline" className="mb-6">
          Powered by Circle x402 on Arc
        </Badge>

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          One handle.
          <br />
          <span className="text-primary">Instant USDC.</span>
          <br />
          Zero gas.
        </h1>

        <p className="text-muted-foreground mb-10 max-w-md text-lg">
          Create your personal payment link and start receiving USDC in seconds.
          No wallets, no complexity — just{" "}
          <span className="font-medium">usdc.me/@you</span>.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link href="/register">Create your handle →</Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </div>

        <p className="text-muted-foreground mt-4 text-sm">
          Already have a link? Try{" "}
          <Link href="/demo" className="text-primary hover:underline">
            usdc.me/@demo
          </Link>
        </p>
      </section>

      <Separator />

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-semibold">
          Payments, finally simple
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t bg-muted/30 px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4 text-sm">
          Built at the Circle Hackathon 2026
        </p>
        <Button asChild>
          <Link href="/register">Get started free</Link>
        </Button>
      </section>
    </div>
  )
}
