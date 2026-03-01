"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { MerchantOverview } from "@/components/merchant-overview"
import type { MerchantAccount } from "@/lib/api"

interface MerchantDashboardProps {
  merchants: MerchantAccount[]
  userHandle: string
  onRegisterNew: () => void
  onShowSetup?: () => void
}

export function MerchantDashboard({
  merchants,
  userHandle,
  onRegisterNew,
  onShowSetup,
}: MerchantDashboardProps) {
  const [selectedId, setSelectedId] = useState(merchants[0]?.id)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
          <p className="text-muted-foreground text-sm">@{userHandle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onShowSetup && (
            <Button variant="outline" size="sm" onClick={onShowSetup}>
              Setup Guide
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRegisterNew}>
            + New Store
          </Button>
        </div>
      </div>

      <Separator />

      {merchants.length === 1 ? (
        // Single merchant — no tabs needed
        <MerchantOverview merchant={merchants[0]} />
      ) : (
        // Multiple merchants — tabbed
        <Tabs value={selectedId} onValueChange={setSelectedId}>
          <TabsList>
            {merchants.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {merchants.map((m) => (
            <TabsContent key={m.id} value={m.id}>
              <MerchantOverview merchant={m} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
