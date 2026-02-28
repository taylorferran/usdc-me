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
}

export function MerchantDashboard({
  merchants,
  userHandle,
  onRegisterNew,
}: MerchantDashboardProps) {
  const [selectedId, setSelectedId] = useState(merchants[0]?.id)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
          <p className="text-muted-foreground text-sm">@{userHandle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRegisterNew}>
          + New Store
        </Button>
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
