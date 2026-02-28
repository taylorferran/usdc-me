/**
 * Check all Gateway and wallet balances using the new getBalances() method.
 *
 * Usage: npx tsx check-balances.ts
 */

import { GatewayClient } from '@circlefin/x402-batching/client';
import 'dotenv/config';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  // Create clients for each chain
  const arcClient = new GatewayClient({
    chain: 'arcTestnet',
    privateKey: PRIVATE_KEY,
  });

  const baseClient = new GatewayClient({
    chain: 'baseSepolia',
    privateKey: PRIVATE_KEY,
  });

  console.log('\n=== Current Balances ===\n');
  console.log(`Account: ${arcClient.address}\n`);

  // Arc Testnet - using new getBalances() method
  console.log('--- Arc Testnet ---');
  const arcBalances = await arcClient.getBalances();
  console.log(`Wallet USDC:       ${arcBalances.wallet.formatted}`);
  console.log(`Gateway Total:     ${arcBalances.gateway.formattedTotal}`);
  console.log(`Gateway Available: ${arcBalances.gateway.formattedAvailable}`);
  console.log(
    `Gateway Withdrawing: ${arcBalances.gateway.formattedWithdrawing} (trustless in progress)`,
  );
  console.log(
    `Gateway Withdrawable: ${arcBalances.gateway.formattedWithdrawable} (trustless ready)`,
  );

  // Base Sepolia - using new getBalances() method
  console.log('\n--- Base Sepolia ---');
  const baseBalances = await baseClient.getBalances();
  console.log(`Wallet USDC:       ${baseBalances.wallet.formatted}`);
  console.log(`Gateway Total:     ${baseBalances.gateway.formattedTotal}`);
  console.log(`Gateway Available: ${baseBalances.gateway.formattedAvailable}`);

  // Summary
  const totalWallet =
    (Number(arcBalances.wallet.balance) + Number(baseBalances.wallet.balance)) / 1e6;
  const totalGateway =
    (Number(arcBalances.gateway.available) + Number(baseBalances.gateway.available)) /
    1e6;

  console.log('\n--- Summary ---');
  console.log(`Total Wallet USDC:     ${totalWallet.toFixed(6)}`);
  console.log(`Total Gateway Available: ${totalGateway.toFixed(6)}`);
}

main().catch(console.error);
