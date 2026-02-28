/**
 * Formats a USDC amount for display.
 *
 * - Always shows at least 2 decimal places (e.g. "1.50")
 * - Shows up to 6 decimal places for sub-cent nano amounts (e.g. "0.000001")
 * - Trims trailing zeros beyond the 2nd decimal place (e.g. "0.010000" → "0.01")
 *
 * USDC has 6 decimal places of precision on-chain, so 6dp is the ceiling.
 */
export function formatUsdc(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(n)) return "0.00"

  // Full precision string (6dp)
  const full = n.toFixed(6)

  // Strip trailing zeros but keep at least 2 decimal places
  const trimmed = full.replace(/0+$/, "")
  const withDot = trimmed.endsWith(".") ? trimmed + "00" : trimmed

  const dotIndex = withDot.indexOf(".")
  if (dotIndex === -1) return withDot + ".00"

  const decimals = withDot.length - dotIndex - 1
  if (decimals < 2) return withDot + "0".repeat(2 - decimals)

  return withDot
}
