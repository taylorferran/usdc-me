/**
 * The Digital Dungeon - Buyer Client (x402 + Gateway Integration)
 *
 * This file demonstrates how to pay for x402-protected resources via Gateway.
 * Display logic is handled separately in display.ts
 *
 * Key x402 concepts shown:
 *   1. Using GatewayClient for easy Gateway integration
 *   2. Checking balances with getBalances()
 *   3. Checking if batching is supported with supports()
 *   4. Paying for resources with pay()
 *
 * Run with: PRIVATE_KEY=0x... npm run play
 */

import * as readline from 'readline';
import type { Hex } from 'viem';
import 'dotenv/config';

// ============================================================================
// X402 GATEWAY SDK IMPORTS
// ============================================================================

import { GatewayClient } from '@circlefin/x402-batching/client';

// ============================================================================
// DISPLAY SERVICE (separate from payment logic)
// ============================================================================

import {
  type GameStatus,
  type ChoiceResult,
  clearScreen,
  printHeader,
  printWelcome,
  printScene,
  printStatus,
  printChoices,
  printResult,
  printSpendingSummary,
  printGameOver,
  printPaymentStep,
  printError,
} from './display';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;

// ============================================================================
// COMMANDS
// ============================================================================

const COMMANDS = {
  QUIT: ['q', 'quit'],
  RESET: ['r', 'reset'],
  CONFIRM_NO: 'n',
} as const;

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable is required');
  console.error('Usage: PRIVATE_KEY=0x... npm run play');
  process.exit(1);
}

// ============================================================================
// GATEWAY CLIENT SETUP
// ============================================================================

/**
 * GatewayClient handles all Gateway operations:
 *   - getBalances(): Get wallet and Gateway balances
 *   - supports(): Check if a URL supports Gateway batching
 *   - pay(): Pay for x402-protected resources (gasless!)
 *   - deposit(): Add USDC to Gateway
 *   - withdraw(): Exit Gateway (same-chain or cross-chain)
 */
const gateway = new GatewayClient({
  chain: 'arcTestnet',
  privateKey: PRIVATE_KEY,
});

// ============================================================================
// READLINE SETUP
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// ============================================================================
// API HELPERS
// ============================================================================

async function getGameStatus(): Promise<GameStatus> {
  const response = await fetch(`${SERVER_URL}/game/status?player=${gateway.address}`);
  if (!response.ok) {
    throw new Error((await response.json()).error || 'Failed to get status');
  }
  return response.json();
}

async function resetGame(): Promise<GameStatus> {
  const response = await fetch(`${SERVER_URL}/game/reset?player=${gateway.address}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error((await response.json()).error || 'Failed to reset');
  }
  return response.json();
}

// ============================================================================
// X402 PAYMENT FLOW (SIMPLIFIED WITH GatewayClient!)
// ============================================================================

/**
 * Make a choice that requires x402 payment.
 *
 * This demonstrates the simplified x402 client flow with GatewayClient:
 *   1. Call gateway.pay() - it handles everything!
 *      - Detects 402 response
 *      - Finds Gateway batching option
 *      - Signs payment (gasless!)
 *      - Retries with Payment-Signature header
 */
async function makeChoice(choiceId: string): Promise<ChoiceResult> {
  const url = `${SERVER_URL}/game/choice/${choiceId}?player=${gateway.address}`;

  printPaymentStep('Making payment (gasless)');

  const result = await gateway.pay<ChoiceResult>(url);

  printPaymentStep(`Paid ${result.formattedAmount} USDC!`);

  return result.data;
}

// ============================================================================
// GAME LOOP
// ============================================================================

async function displayGame(status: GameStatus): Promise<void> {
  clearScreen();
  printHeader();
  printScene(status.scene);
  printStatus(status.status);

  if (!status.scene.isEnding && status.choices.length > 0) {
    printChoices(status.choices);
  }
}

async function gameLoop(): Promise<void> {
  let status: GameStatus;

  try {
    status = await getGameStatus();
  } catch (err) {
    printError((err as Error).message);
    console.log('\nMake sure the server is running: cd ../seller-express && npm start');
    rl.close();
    return;
  }

  await displayGame(status);

  while (true) {
    // Check for game over
    if (status.scene.isEnding) {
      printGameOver(status.scene.endingType || 'defeat', status.status);

      const again = await prompt('\nPlay again? [Y/n]: ');
      if (again.toLowerCase() !== COMMANDS.CONFIRM_NO) {
        status = await resetGame();
        await displayGame(status);
        continue;
      }
      break;
    }

    const input = await prompt('\nYour choice: ');

    // Handle commands
    if (COMMANDS.QUIT.includes(input.toLowerCase() as (typeof COMMANDS.QUIT)[number])) {
      console.log('\nThanks for playing!\n');
      break;
    }

    if (COMMANDS.RESET.includes(input.toLowerCase() as (typeof COMMANDS.RESET)[number])) {
      status = await resetGame();
      await displayGame(status);
      continue;
    }

    // Parse choice
    let choiceId: string | undefined;
    const choiceNum = parseInt(input);

    if (!isNaN(choiceNum) && choiceNum > 0 && choiceNum <= status.choices.length) {
      choiceId = status.choices[choiceNum - 1].id;
    } else {
      const match = status.choices.find((c) => c.id === input);
      if (match) choiceId = match.id;
    }

    if (!choiceId) {
      printError(`Enter 1-${status.choices.length}, Q to quit, or R to reset.`);
      continue;
    }

    // Make the choice (with x402 payment)
    try {
      const result = await makeChoice(choiceId);

      clearScreen();
      printHeader();
      printResult(result);
      printSpendingSummary(result.spending, result.transaction);

      await prompt('\nPress Enter to continue...');

      status = {
        scene: result.scene,
        choices: result.choices,
        status: result.status,
      };

      await displayGame(status);
    } catch (err) {
      printError((err as Error).message);
      console.log('\n(Make sure you have USDC deposited in Gateway)');
      console.log('Run: npx tsx deposit.ts --amount 10');
    }
  }

  rl.close();
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  clearScreen();
  printWelcome(gateway.address, SERVER_URL);

  // Show balances before starting
  console.log('\nChecking balances...');
  const balances = await gateway.getBalances();
  console.log(`  Wallet:  ${balances.wallet.formatted} USDC`);
  console.log(`  Gateway: ${balances.gateway.formattedAvailable} USDC available`);

  if (parseFloat(balances.gateway.formattedAvailable) < 0.01) {
    console.log('\n⚠️  Low Gateway balance! Deposit first:');
    console.log('   npx tsx deposit.ts --amount 10\n');
  }

  const ready = await prompt('\nReady to enter the dungeon? [Y/n]: ');

  if (ready.toLowerCase() === COMMANDS.CONFIRM_NO) {
    console.log('\nPerhaps another time!\n');
    rl.close();
    return;
  }

  await gameLoop();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  rl.close();
  process.exit(1);
});
