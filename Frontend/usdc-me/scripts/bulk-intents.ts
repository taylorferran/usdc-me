/**
 * Bulk Nanopayment Intent Generator
 *
 * Generates many x402 payment intents and POSTs them to /api/send-signed.
 * Then hit "Settle Now" in the UI to batch-settle them all at once.
 *
 * Usage:
 *   SENDER_PRIVATE_KEY=0x... npx tsx scripts/bulk-intents.ts
 *   SENDER_PRIVATE_KEY=0x... API_URL=http://localhost:3000 INTENT_COUNT=20 npx tsx scripts/bulk-intents.ts
 */

import { type Hex, type Address, getAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"

// ── Constants (mirrored from lib/wallet.ts) ─────────────────────────────────

const ARC_CHAIN_ID = 5042002
const ARC_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const

// ── EIP-712 types (mirrored from lib/signing.ts) ────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function createNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex
}

function randomAddress(): Address {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return getAddress(
    `0x${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`
  )
}

/** Random amount between $0.0001 and $0.01 as atomic USDC (6 decimals) */
function randomAmount(): { display: string; atomic: string } {
  const microDollars = Math.floor(Math.random() * 100) + 1 // 1–100 (i.e. $0.0001–$0.0100)
  const display = (microDollars / 10000).toFixed(4)
  const atomic = (microDollars * 100).toString() // microDollars * 100 = atomic (6 decimals)
  return { display, atomic }
}

async function signIntent(
  privateKey: Hex,
  payTo: Address,
  amountAtomic: string
) {
  const account = privateKeyToAccount(privateKey)
  const nonce = createNonce()
  const now = Math.floor(Date.now() / 1000)

  const authorization = {
    from: account.address,
    to: getAddress(payTo),
    value: amountAtomic,
    validAfter: (now - 600).toString(),
    validBefore: (now + 345600).toString(),
    nonce,
  }

  const signature = await account.signTypedData({
    domain: {
      name: "GatewayWalletBatched",
      version: "1",
      chainId: ARC_CHAIN_ID,
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const privateKey = process.env.SENDER_PRIVATE_KEY as Hex | undefined
  if (!privateKey) {
    console.error("Error: SENDER_PRIVATE_KEY env var is required")
    console.error(
      "Usage: SENDER_PRIVATE_KEY=0x... npx tsx scripts/bulk-intents.ts"
    )
    process.exit(1)
  }

  const apiUrl = process.env.API_URL ?? "https://usdc-me.vercel.app"
  const count = parseInt(process.env.INTENT_COUNT ?? "50", 10)

  const account = privateKeyToAccount(privateKey)
  console.log(`\nSender: ${account.address}`)
  console.log(`API:    ${apiUrl}`)
  console.log(`Count:  ${count}\n`)

  let created = 0
  let failed = 0
  const concurrency = parseInt(process.env.CONCURRENCY ?? "20", 10)

  // Pre-sign all intents
  const intents = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const to = randomAddress()
      const { display, atomic } = randomAmount()
      const signedPayload = await signIntent(privateKey, to, atomic)
      return { i, to, display, signedPayload }
    })
  )

  // Send in batches
  for (let batch = 0; batch < intents.length; batch += concurrency) {
    const chunk = intents.slice(batch, batch + concurrency)
    await Promise.all(
      chunk.map(async ({ i, to, display, signedPayload }) => {
        try {
          const res = await fetch(`${apiUrl}/api/send-signed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from: account.address,
              to,
              amount: display,
              signedPayload,
            }),
          })

          const data = await res.json()

          if (res.ok) {
            created++
            console.log(
              `  [${i + 1}/${count}] $${display} -> ${to.slice(0, 10)}... (${data.intentId?.slice(0, 8)}...)`
            )
          } else {
            failed++
            console.error(
              `  [${i + 1}/${count}] FAILED: ${data.error} - ${data.reason ?? data.details ?? ""}`
            )
          }
        } catch (err) {
          failed++
          console.error(
            `  [${i + 1}/${count}] FAILED: ${err instanceof Error ? err.message : err}`
          )
        }
      })
    )
  }

  console.log(`\nDone! Created ${created} intents.${failed > 0 ? ` (${failed} failed)` : ""}`)
  console.log(`Go to the dashboard and click "Settle Now" to batch-settle them all!\n`)
}

main()
