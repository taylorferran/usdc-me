/**
 * Deposit USDC into the Gateway contract directly from a wallet.
 *
 * Usage:
 *   SENDER_PRIVATE_KEY=0x... AMOUNT=5 npx tsx scripts/deposit-gateway.ts
 */

import { type Hex, erc20Abi, parseUnits, formatUnits, getAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, http, defineChain } from "viem"

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://arc-testnet.drpc.org"] },
  },
})

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const
const ARC_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const

const GATEWAY_WALLET_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
] as const

async function main() {
  const privateKey = process.env.SENDER_PRIVATE_KEY as Hex | undefined
  if (!privateKey) {
    console.error("Error: SENDER_PRIVATE_KEY env var is required")
    process.exit(1)
  }

  const amount = process.env.AMOUNT ?? "5"
  const depositAmount = parseUnits(amount, 6)

  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() })
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() })

  const balance = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  })

  console.log(`\nWallet:  ${account.address}`)
  console.log(`Balance: ${formatUnits(balance, 6)} USDC`)
  console.log(`Deposit: ${amount} USDC\n`)

  if (balance < depositAmount) {
    console.error(`Insufficient USDC. Have ${formatUnits(balance, 6)}, need ${amount}`)
    process.exit(1)
  }

  // Approve gateway to spend USDC
  console.log("Approving gateway...")
  const approveTx = await walletClient.writeContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [getAddress(ARC_GATEWAY_WALLET), depositAmount],
  })
  await publicClient.waitForTransactionReceipt({ hash: approveTx })
  console.log(`Approved: ${approveTx}`)

  // Deposit into gateway
  console.log("Depositing into gateway...")
  const depositTx = await walletClient.writeContract({
    address: getAddress(ARC_GATEWAY_WALLET),
    abi: GATEWAY_WALLET_ABI,
    functionName: "deposit",
    args: [getAddress(ARC_USDC_ADDRESS), depositAmount],
  })
  await publicClient.waitForTransactionReceipt({ hash: depositTx })
  console.log(`Deposited: ${depositTx}`)

  console.log(`\nDone! ${amount} USDC deposited into gateway for ${account.address}\n`)
}

main()
