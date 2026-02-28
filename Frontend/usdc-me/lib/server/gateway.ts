import { GatewayClient } from "@circlefin/x402-batching/client"
import { BatchFacilitatorClient } from "@circlefin/x402-batching/server"
import { generatePrivateKey } from "viem/accounts"

export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const
export const ARC_NETWORK = "eip155:5042002"

export interface SupportedKind {
  scheme: string
  network: string
  extra?: {
    asset?: string
    verifyingContract?: string
    assets?: Array<{ address: string }>
    [key: string]: unknown
  }
}

// Module-level cache — lives for the lifetime of a serverless instance.
// Avoids re-fetching supported kinds on every request within the same warm instance.
let facilitatorInstance: BatchFacilitatorClient | null = null
let supportedKindsCache: SupportedKind[] | null = null

export function getFacilitator(): BatchFacilitatorClient {
  if (!facilitatorInstance) {
    facilitatorInstance = new BatchFacilitatorClient()
  }
  return facilitatorInstance
}

export async function getSupportedKinds(): Promise<SupportedKind[]> {
  if (supportedKindsCache) return supportedKindsCache
  const facilitator = getFacilitator()
  try {
    const supported = await facilitator.getSupported()
    supportedKindsCache = supported.kinds as SupportedKind[]
  } catch {
    // Fall back to empty — routes use hardcoded values as fallback
    supportedKindsCache = []
  }
  return supportedKindsCache
}

const ARC_RPC_URL = "https://arc-testnet.drpc.org"

/** Read-only gateway using a throwaway key — only for balance queries. */
export function createPlatformGateway(): GatewayClient {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey: generatePrivateKey(),
    rpcUrl: ARC_RPC_URL,
  })
}

/** User gateway — signs withdrawals with the user's private key. */
export function createUserGateway(privateKey: `0x${string}`): GatewayClient {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey,
    rpcUrl: ARC_RPC_URL,
  })
}
