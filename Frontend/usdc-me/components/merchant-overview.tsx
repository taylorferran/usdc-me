"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons/core-free-icons"

import * as api from "@/lib/api"
import type {
  MerchantAccount,
  MerchantPayment,
  PaymentSummary,
  BalanceResponse,
} from "@/lib/api"
import { MerchantStatsCards } from "@/components/merchant-stats-cards"
import { MerchantPaymentTable } from "@/components/merchant-payment-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

type StatusFilter = "all" | "paid" | "pending" | "expired"

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
]

function exportPaymentsCSV(
  payments: MerchantPayment[],
  merchantName: string
) {
  const headers = [
    "Payment ID",
    "Date",
    "Description",
    "Amount (USDC)",
    "Status",
    "Payer Address",
  ]
  const rows = payments.map((p) => [
    p.id,
    new Date(p.created_at).toISOString(),
    p.description ?? "",
    p.amount,
    p.status,
    p.payer_address ?? "",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${merchantName.replace(/\s+/g, "-").toLowerCase()}-payments-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

interface MerchantOverviewProps {
  merchant: MerchantAccount
}

export function MerchantOverview({ merchant }: MerchantOverviewProps) {
  const [payments, setPayments] = useState<MerchantPayment[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Settings form
  const [editName, setEditName] = useState(merchant.name)
  const [editCallback, setEditCallback] = useState(
    merchant.callback_url ?? ""
  )
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(
    async (filter?: StatusFilter) => {
      setIsLoading(true)
      try {
        const [paymentsRes, balanceRes] = await Promise.all([
          api.getMerchantPayments(merchant.id, {
            status: (filter ?? statusFilter) === "all"
              ? undefined
              : (filter ?? statusFilter),
          }),
          api.getBalance(merchant.wallet_address),
        ])
        setPayments(paymentsRes.payments)
        setSummary(paymentsRes.summary)
        setBalance(balanceRes)
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    },
    [merchant.id, merchant.wallet_address, statusFilter]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFilterChange = (f: StatusFilter) => {
    setStatusFilter(f)
    fetchData(f)
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await api.updateMerchant(merchant.id, {
        name: editName,
        callback_url: editCallback,
      })
      toast.success("Settings saved")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <MerchantStatsCards
        summary={summary}
        balance={balance}
        isLoading={isLoading}
      />

      {/* Filter + Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPaymentsCSV(payments, merchant.name)}
            disabled={payments.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fetchData()}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>
        </div>
      </div>

      {/* Payments table */}
      <MerchantPaymentTable payments={payments} isLoading={isLoading} />

      <Separator />

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Merchant Settings</CardTitle>
          <CardDescription>
            Update your store name or webhook callback URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merchantName">Store Name</Label>
            <Input
              id="merchantName"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="callbackUrl">Webhook Callback URL</Label>
            <Input
              id="callbackUrl"
              placeholder="https://your-site.com/webhooks/usdcme"
              value={editCallback}
              onChange={(e) => setEditCallback(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              We POST payment events here when a customer pays. Leave empty to
              disable.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="bg-muted text-muted-foreground rounded-lg p-3 font-mono text-xs break-all">
              {merchant.wallet_address}
            </div>
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={saving || !editName.trim()}
          >
            {saving ? (
              <>
                <Spinner className="mr-2 size-4" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
