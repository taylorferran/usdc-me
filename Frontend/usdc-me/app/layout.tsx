import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Raleway } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import Header from "@/components/Header"
import { AuthProvider } from "@/contexts/auth-context"
import { ServiceWorkerRegister } from "@/components/service-worker-register"

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
  title: "USDC.me — Instant USDC Payments",
  description: "One handle. Instant USDC. Zero gas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "USDC.me",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/favicon-32.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  )
}
