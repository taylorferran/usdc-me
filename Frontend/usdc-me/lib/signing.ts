import { type Hex, type Address, getAddress, erc20Abi, parseUnits, formatUnits } from "viem"
import { createClients, ARC_GATEWAY_WALLET, ARC_USDC_ADDRESS } from "./wallet"

const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const

function createNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex
}

/**
 * Sign an x402 payment payload in the browser.
 * Replicates BatchEvmScheme.createPaymentPayload() from the Circle SDK.
 */
export async function signX402Payment(
  privateKey: Hex,
  payTo: Address,
  amountAtomic: string,
  chainId: number,
  maxTimeoutSeconds: number = 345600
) {
  const { account } = createClients(privateKey)
  const nonce = createNonce()
  const now = Math.floor(Date.now() / 1000)

  const authorization = {
    from: account.address,
    to: getAddress(payTo),
    value: amountAtomic,
    validAfter: (now - 600).toString(),
    validBefore: (now + maxTimeoutSeconds).toString(),
    nonce,
  }

  const signature = await account.signTypedData({
    domain: {
      name: "GatewayWalletBatched",
      version: "1",
      chainId,
      verifyingContract: getAddress(ARC_GATEWAY_WALLET),
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  })

  return {
    x402Version: 2,
    payload: { authorization, signature },
  }
}

// GatewayWallet deposit ABI
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

/**
 * Deposit USDC from wallet into Gateway contract (wallet → Gateway).
 * Approves if needed, then calls deposit(). All signed client-side.
 */
export async function deposit(privateKey: Hex, amount: string) {
  const { account, publicClient, walletClient } = createClients(privateKey)
  const requestedAmount = parseUnits(amount, 6)

  console.log("[deposit] === Starting deposit ===")
  console.log("[deposit] Account:", account.address)
  console.log("[deposit] Gateway contract:", ARC_GATEWAY_WALLET)
  console.log("[deposit] USDC contract:", ARC_USDC_ADDRESS)
  console.log("[deposit] Requested amount (human):", amount)
  console.log("[deposit] Requested amount (atomic):", requestedAmount.toString())

  const balance = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  })

  console.log("[deposit] Balance (raw):", balance.toString())
  console.log("[deposit] Balance (human):", formatUnits(balance, 6))

  if (balance < requestedAmount) {
    throw new Error(
      `Insufficient USDC. Have: ${formatUnits(balance, 6)}, Need: ${amount}`
    )
  }

  // Check allowance — approve a large amount to avoid re-approving next time
  const allowance = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ARC_GATEWAY_WALLET],
  })

  console.log("[deposit] Current allowance (raw):", allowance.toString())
  console.log("[deposit] Needs approval?", allowance < requestedAmount)

  if (allowance < requestedAmount) {
    // Approve max uint256 so we never need to approve again (gas on Arc = USDC,
    // so every extra tx costs real balance). This is safe because only the
    // Gateway contract can pull funds, and only via the deposit function.
    const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
    console.log("[deposit] Approving Gateway for max uint256...")
    const approveTx = await walletClient.writeContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [ARC_GATEWAY_WALLET, MAX_UINT256],
    })
    console.log("[deposit] Approve tx hash:", approveTx)
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log("[deposit] Approve tx status:", approveReceipt.status)

    // Wait for RPC nodes to sync the new allowance. drpc.org load-balances
    // across multiple nodes — the deposit simulation can hit a stale node
    // that hasn't seen the approve yet, causing a spurious revert.
    console.log("[deposit] Waiting for RPC state to propagate...")
    let synced = false
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const checkAllowance = await publicClient.readContract({
        address: ARC_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, ARC_GATEWAY_WALLET],
      })
      console.log(`[deposit] Allowance poll #${i + 1}:`, checkAllowance.toString())
      if (checkAllowance >= requestedAmount) {
        synced = true
        break
      }
    }
    if (!synced) {
      throw new Error("Allowance not confirmed after approval — RPC may be lagging. Please retry.")
    }
    console.log("[deposit] Allowance confirmed, proceeding to deposit")
  }

  // Re-read balance after approve — on Arc, gas is paid in USDC so the
  // approve tx itself reduces our USDC balance. Deposit whatever is left,
  // capped at the requested amount.
  const balanceAfterApprove = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  })

  console.log("[deposit] Balance after approve (raw):", balanceAfterApprove.toString())
  console.log("[deposit] Balance after approve (human):", formatUnits(balanceAfterApprove, 6))

  // Reserve a buffer for the deposit tx's own gas cost
  const GAS_RESERVE = BigInt(100_000) // 0.1 USDC
  const maxDepositable = balanceAfterApprove > GAS_RESERVE
    ? balanceAfterApprove - GAS_RESERVE
    : BigInt(0)

  // Deposit the lesser of what they asked for and what's actually available
  const depositAmount = requestedAmount < maxDepositable ? requestedAmount : maxDepositable

  console.log("[deposit] Gas reserve:", formatUnits(GAS_RESERVE, 6))
  console.log("[deposit] Max depositable:", formatUnits(maxDepositable, 6))
  console.log("[deposit] Final deposit amount:", formatUnits(depositAmount, 6))

  if (depositAmount <= BigInt(0)) {
    throw new Error(
      `Balance too low after gas. Have: ${formatUnits(balanceAfterApprove, 6)} USDC, need gas reserve of ${formatUnits(GAS_RESERVE, 6)} USDC`
    )
  }

  console.log("[deposit] Calling Gateway.deposit(", ARC_USDC_ADDRESS, ",", depositAmount.toString(), ")...")
  const depositTx = await walletClient.writeContract({
    address: ARC_GATEWAY_WALLET,
    abi: GATEWAY_WALLET_ABI,
    functionName: "deposit",
    args: [ARC_USDC_ADDRESS, depositAmount],
  })
  console.log("[deposit] Deposit tx hash:", depositTx)
  const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositTx })
  console.log("[deposit] Deposit tx status:", depositReceipt.status)
  console.log("[deposit] === Deposit complete ===")

  return { depositTxHash: depositTx, amount: depositAmount }
}
