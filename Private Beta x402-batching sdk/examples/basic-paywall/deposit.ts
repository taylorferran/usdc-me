/**
 * Deposit USDC into the Gateway Wallet contract.
 *
 * This is a prerequisite for using Circle Gateway batched payments.
 * The buyer must have a USDC balance in the Gateway contract to pay for resources.
 *
 * Usage:
 * 1. Get Testnet USDC from https://faucet.circle.com (Use Arc Testnet)
 * 2. Set PRIVATE_KEY environment variable
 * 3. Run: npx tsx deposit.ts --amount 0.5
 *
 * Options:
 *   --amount, -a   Amount of USDC to deposit (default: 0.5)
 *   --help, -h     Show this help message
 */

import type { Hex } from 'viem';
import 'dotenv/config';

import { GatewayClient } from '@circlefin/x402-batching/client';

function parseArgs(): { depositAmount: string } {
  const args = process.argv.slice(2);
  let depositAmount = process.env.DEPOSIT_AMOUNT || '0.5';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx deposit.ts [options]

Options:
  --amount, -a <value>   Amount of USDC to deposit (default: 0.5)
  --help, -h             Show this help message

Get testnet USDC from: https://faucet.circle.com

Examples:
  npx tsx deposit.ts              # Deposit 0.5 USDC (default)
  npx tsx deposit.ts --amount 0.3 # Deposit 0.3 USDC
`);
      process.exit(0);
    }

    if ((arg === '--amount' || arg === '-a') && args[i + 1]) {
      depositAmount = args[++i];
    }
  }

  if (isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
    console.error('Error: Invalid deposit amount. Must be a positive number.');
    process.exit(1);
  }

  return { depositAmount };
}

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;
const { depositAmount: DEPOSIT_AMOUNT } = parseArgs();

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('\n=== Deposit USDC into Gateway Wallet ===\n');

  const gateway = new GatewayClient({
    chain: 'arcTestnet',
    privateKey: PRIVATE_KEY!,
  });

  console.log('Account:', gateway.address);
  console.log('Chain:', gateway.chainName);

  console.log('\n1. Checking balances...');
  const before = await gateway.getBalances();
  console.log('   Wallet USDC:', before.wallet.formatted);
  console.log('   Gateway Available:', before.gateway.formattedAvailable);

  if (parseFloat(before.wallet.formatted) < parseFloat(DEPOSIT_AMOUNT)) {
    console.error('\nInsufficient USDC balance.');
    console.error('Get tokens from: https://faucet.circle.com');
    return;
  }

  console.log('\n2. Depositing', DEPOSIT_AMOUNT, 'USDC...');
  const result = await gateway.deposit(DEPOSIT_AMOUNT);
  console.log('   Tx:', result.depositTxHash);

  console.log('\n3. Updated balances:');
  const after = await gateway.getBalances();
  console.log('   Wallet USDC:', after.wallet.formatted);
  console.log('   Gateway Available:', after.gateway.formattedAvailable);

  console.log('\nDone! You can now make gasless payments.\n');
}

main().catch(console.error);
