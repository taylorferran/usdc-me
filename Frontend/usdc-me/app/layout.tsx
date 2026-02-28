import type { Metadata } from "next"
import { Geist, Geist_Mono, Raleway } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import Header from "@/components/Header"
import { AuthProvider } from "@/contexts/auth-context"

const raleway = Raleway({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "USDC-ME — Instant USDC Payments",
  description: "One handle. Instant USDC. Zero gas.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={raleway.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <TooltipProvider>
            <Header />
            <main>{children}</main>
          </TooltipProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
