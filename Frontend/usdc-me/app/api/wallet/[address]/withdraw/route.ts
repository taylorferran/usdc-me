import { NextResponse } from "next/server"
import { createUserGateway } from "@/lib/server/gateway"
import { supabaseAdmin } from "@/lib/server/supabase"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  try {
    const { amount, chain, recipient, privateKey } = await req.json()

    if (!amount || !privateKey) {
      return NextResponse.json(
        { error: "Amount and privateKey are required" },
        { status: 400 }
      )
    }

    const gateway = createUserGateway(privateKey)

    const withdrawOptions: Record<string, string> = {}
    if (chain) withdrawOptions.chain = chain
    if (recipient) withdrawOptions.recipient = recipient

    const result = await gateway.withdraw(
      amount,
      Object.keys(withdrawOptions).length > 0 ? withdrawOptions : undefined
    )

    await supabaseAdmin.from("transactions").insert({
      id: crypto.randomUUID(),
      type: "withdraw",
      from_address: address,
      to_address: result.recipient,
      amount: result.formattedAmount,
      status: "settled",
      tx_hash: result.mintTxHash,
      network: result.destinationChain,
    })

    return NextResponse.json({
      status: "withdrawn",
      txHash: result.mintTxHash,
      amount: result.formattedAmount,
      sourceChain: result.sourceChain,
      destinationChain: result.destinationChain,
      recipient: result.recipient,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Withdrawal failed", details: message },
      { status: 500 }
    )
  }
}
