/**
 * Test the GatewayClient.withdraw() method.
 *
 * Demonstrates:
 * 1. Same-chain withdrawal (instant)
 * 2. Cross-chain withdrawal to Base Sepolia (requires ETH on Base for gas)
 */

import { GatewayClient } from '@circlefin/x402-batching/client';
import 'dotenv/config';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('\n=== Testing GatewayClient.withdraw() ===\n');

  const client = new GatewayClient({
    chain: 'arcTestnet',
    privateKey: PRIVATE_KEY,
  });

  console.log(`Account: ${client.address}`);
  console.log(`Source Chain: ${client.chainName}`);

  // Check balance before using new getBalances()
  console.log('\n1. Checking balances before withdraw...');
  const before = await client.getBalances();
  console.log(`   Gateway Available: ${before.gateway.formattedAvailable} USDC`);
  console.log(`   Wallet USDC: ${before.wallet.formatted} USDC`);

  if (before.gateway.available < 10000n) {
    // 0.01 USDC
    console.log('\n⚠️  Insufficient Gateway balance for test. Deposit first.');
    return;
  }

  // Test same-chain withdrawal (instant!)
  console.log('\n2. Testing same-chain withdrawal (instant)...');
  console.log('   Withdrawing 0.01 USDC from Gateway to wallet on Arc Testnet...');

  try {
    const result = await client.withdraw('0.01');
    console.log(`   ✅ Withdrawal successful!`);
    console.log(`   Mint Tx: ${result.mintTxHash}`);
    console.log(`   Amount: ${result.formattedAmount} USDC`);
    console.log(`   Source: ${result.sourceChain}`);
    console.log(`   Destination: ${result.destinationChain}`);
    console.log(`   Recipient: ${result.recipient}`);
  } catch (error) {
    console.error(`   ❌ Withdrawal failed: ${(error as Error).message}`);
  }

  // Check balance after
  console.log('\n3. Checking balances after withdrawal...');
  const after = await client.getBalances();
  console.log(`   Gateway Available: ${after.gateway.formattedAvailable} USDC`);
  console.log(
    `   Gateway Change: ${(Number(after.gateway.available) - Number(before.gateway.available)) / 1e6} USDC`,
  );
  console.log(`   Wallet USDC: ${after.wallet.formatted} USDC`);
  console.log(
    `   Wallet Change: ${(Number(after.wallet.balance) - Number(before.wallet.balance)) / 1e6} USDC`,
  );

  // Cross-chain withdrawal example (commented - needs ETH on Base)
  console.log('\n4. Cross-chain withdrawal example (not executed):');
  console.log('');
  console.log('   // Withdraw 0.02 USDC to Base Sepolia - requires ETH on Base for gas!');
  console.log(
    "   // const crossChainResult = await client.withdraw('0.02', { chain: 'baseSepolia' });",
  );
  console.log("   // console.log('Mint Tx:', crossChainResult.mintTxHash);");
  console.log('');
  console.log(
    '   To run this, ensure you have ETH on Base Sepolia for the mint transaction gas.',
  );
}

main().catch(console.error);
