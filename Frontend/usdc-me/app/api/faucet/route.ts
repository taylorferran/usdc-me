import { NextResponse } from "next/server"
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  erc20Abi,
  parseUnits,
  formatUnits,
  isAddress,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"

export const runtime = "nodejs"

const FAUCET_AMOUNT = "2.1" // USDC (extra 0.1 covers gas for deposit tx)
const USDC_DECIMALS = 6

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://arc-testnet.drpc.org"] },
  },
})

const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const

export async function POST(req: Request) {
  try {
    const faucetKey = process.env.FAUCET_PRIVATE_KEY
    if (!faucetKey) {
      return NextResponse.json(
        { error: "Faucet not configured" },
        { status: 503 }
      )
    }

    const { address } = await req.json()
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: "Valid address is required" },
        { status: 400 }
      )
    }

    const account = privateKeyToAccount(faucetKey as `0x${string}`)
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    })
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    })

    // Check faucet balance
    const amount = parseUnits(FAUCET_AMOUNT, USDC_DECIMALS)
    const balance = await publicClient.readContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    })

    if (balance < amount) {
      return NextResponse.json(
        {
          error: `Faucet is empty. Balance: ${formatUnits(balance, USDC_DECIMALS)} USDC`,
        },
        { status: 503 }
      )
    }

    // Transfer USDC from faucet to user
    const txHash = await walletClient.writeContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [address as `0x${string}`, amount],
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })

    return NextResponse.json({
      status: "funded",
      txHash,
      amount: FAUCET_AMOUNT,
      from: account.address,
      to: address,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Faucet transfer failed", details: message },
      { status: 500 }
    )
  }
}
