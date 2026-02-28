import { NextResponse } from "next/server"
import { createPlatformGateway } from "@/lib/server/gateway"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  try {
    const gateway = createPlatformGateway()
    const balances = await gateway.getBalances(address as `0x${string}`)
    return NextResponse.json({
      address,
      wallet: { balance: balances.wallet.formatted },
      gateway: {
        total: balances.gateway.formattedTotal,
        available: balances.gateway.formattedAvailable,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to check balance", details: message },
      { status: 500 }
    )
  }
}
