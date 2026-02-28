/**
 * Simple Buyer Example - Circle Gateway SDK
 *
 * This example demonstrates the typical buyer flow:
 * 1. Create a Gateway client
 * 2. Deposit USDC (one-time setup)
 * 3. Check balances
 * 4. Pay for resources (many times, gasless!)
 * 5. Withdraw when done
 *
 * Usage:
 *   npx tsx simple.ts
 */

import { GatewayClient } from '@circlefin/x402-batching/client';
import type { Hex } from 'viem';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Get testnet USDC from: https://faucet.circle.com (Arc Testnet)
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;
const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3002';

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable required');
  console.error('Usage: PRIVATE_KEY=0x... npx tsx simple.ts');
  console.error('\nGet testnet USDC from: https://faucet.circle.com');
  process.exit(1);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n=== Circle Gateway SDK - Simple Buyer Example ===\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Create Gateway Client
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Creating Gateway client...');

  const gateway = new GatewayClient({
    chain: 'arcTestnet',
    privateKey: PRIVATE_KEY,
  });

  console.log(`   Address: ${gateway.address}`);
  console.log(`   Chain: ${gateway.chainName}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Check Balances (all in one call!)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Checking balances...');

  const balances = await gateway.getBalances();

  console.log(`   Wallet USDC:  ${balances.wallet.formatted}`);
  console.log(`   Gateway:      ${balances.gateway.formattedTotal} total`);
  console.log(`                 ${balances.gateway.formattedAvailable} available`);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Deposit (if needed)
  // ──────────────────────────────────────────────────────────────────────────
  const depositAmount = '1'; // 1 USDC

  if (parseFloat(balances.gateway.formattedAvailable) < 0.01) {
    if (parseFloat(balances.wallet.formatted) < parseFloat(depositAmount)) {
      console.log('\n3. ⚠️ Insufficient wallet balance for deposit');
      console.log('   Get testnet USDC from: https://faucet.circle.com');
      return;
    } else {
      console.log(`\n3. Depositing ${depositAmount} USDC to Gateway...`);

      const depositResult = await gateway.deposit(depositAmount);
      console.log(`   ✅ Deposited! Tx: ${depositResult.depositTxHash}`);
    }
  } else {
    console.log('\n3. ✅ Already have sufficient Gateway balance');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Check if Server Supports Batching (optional safety check)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. Checking if server supports batching...');

  const paidUrl = `${SERVER_URL}/paid`;
  const support = await gateway.supports(paidUrl);

  if (support.supported) {
    console.log('   ✅ Server supports Gateway batching!');
  } else {
    console.log('   ❌ Server does NOT support Gateway batching');
    console.log(`   Reason: ${support.error}`);
    console.log(
      '   Make sure the seller server is running: cd ../seller-express && npm run simple',
    );
    return;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Pay for a Resource (Gasless!)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n5. Paying for /paid endpoint...');

  try {
    const result = await gateway.pay(paidUrl);

    console.log(`   ✅ Paid ${result.formattedAmount} USDC!`);
    console.log(`   Transaction: ${result.transaction}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.log(`   ❌ Payment failed: ${(error as Error).message}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Check Updated Balances
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n6. Checking updated balances...');

  const newBalances = await gateway.getBalances();

  console.log(`   Wallet USDC:  ${newBalances.wallet.formatted}`);
  console.log(`   Gateway:      ${newBalances.gateway.formattedAvailable} available`);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Withdraw Example (commented - shows how to exit Gateway)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n7. Withdraw Examples (not executed, just showing usage):');
  console.log('');
  console.log('   // Withdraw to same chain (Arc Testnet) - instant!');
  console.log("   // await gateway.withdraw('0.05');");
  console.log('');
  console.log('   // Withdraw to Base Sepolia - requires ETH on Base for gas!');
  console.log("   // await gateway.withdraw('0.05', { chain: 'baseSepolia' });");

  console.log('\n=== Done! ===\n');
}

main().catch(console.error);
