/**
 * Display Service - CLI Rendering
 *
 * Handles all terminal output formatting, separate from the x402 payment logic.
 */

import chalk from 'chalk';

// ============================================================================
// TYPES (matching server responses)
// ============================================================================

export interface GameStatus {
  scene: {
    id: string;
    title: string;
    chapter: number;
    ascii: string;
    narrative: string;
    isEnding: boolean;
    endingType?: 'victory' | 'defeat';
  };
  choices: Array<{
    index: number;
    id: string;
    label: string;
    emoji: string;
    price: string;
  }>;
  status: {
    hp: number;
    maxHp: number;
    hpBar: string;
    inventoryDisplay: string;
    inventory: Array<{ id: string; name: string; emoji: string }>;
    choicesMade: number;
    totalSpent: string;
    gasSpent: string;
  };
}

export interface ChoiceResult {
  success: boolean;
  choice: { label: string; emoji: string };
  result: string;
  hpChange: number;
  itemGained: { id: string; name: string } | null;
  spending: {
    thisTx: string;
    totalSpent: string;
    gasSpent: string;
  };
  transaction: string;
  scene: GameStatus['scene'];
  choices: GameStatus['choices'];
  status: GameStatus['status'];
}

// ============================================================================
// SCREEN HELPERS
// ============================================================================

export function clearScreen(): void {
  console.clear();
}

export function printHeader(): void {
  console.log(
    chalk.cyan(`
+===============================================+
|       THE DIGITAL DUNGEON                     |
|       Pay-to-Play Adventure                   |
+===============================================+
`),
  );
}

// ============================================================================
// GAME DISPLAY
// ============================================================================

export function printScene(scene: GameStatus['scene']): void {
  console.log(chalk.yellow(`\n--- Chapter ${scene.chapter}: ${scene.title} ---\n`));

  // Colorize ASCII art based on context
  let artColor = chalk.gray;
  if (scene.isEnding) {
    if (scene.endingType === 'victory') artColor = chalk.greenBright;
    else artColor = chalk.redBright;
  } else if (scene.id === 'treasure') {
    artColor = chalk.yellowBright;
  } else if (scene.id === 'guardian') {
    artColor = chalk.red;
  } else {
    artColor = chalk.cyan;
  }

  console.log(artColor(scene.ascii));
  console.log(`\n${scene.narrative}\n`);
}

export function printStatus(status: GameStatus['status']): void {
  console.log(chalk.gray('─'.repeat(50)));

  // Colorize health bar: Green > 50%, Yellow > 20%, Red otherwise
  const hpPercent = status.hp / status.maxHp;
  let hpColor = chalk.green;
  if (hpPercent < 0.2) hpColor = chalk.redBright;
  else if (hpPercent < 0.5) hpColor = chalk.yellow;

  const inventoryEmojis = status.inventory.map((i) => i.emoji).join(' ') || 'Empty';

  console.log(
    hpColor(`HP: ${status.hpBar}`) +
      chalk.gray('  |  ') +
      chalk.yellow(`Inventory: ${inventoryEmojis}`),
  );
  console.log(chalk.gray('─'.repeat(50)));
}

export function printChoices(choices: GameStatus['choices']): void {
  console.log(chalk.cyan('\nChoices:'));
  console.log(chalk.gray('─'.repeat(50)));

  for (const choice of choices) {
    console.log(
      `  [${choice.index}] ` +
        chalk.cyan(`${choice.label.padEnd(30)}`) +
        chalk.green(choice.price),
    );
  }

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.gray('  [Q] Quit    [R] Reset'));
}

// ============================================================================
// RESULT DISPLAY
// ============================================================================

export function printResult(result: ChoiceResult): void {
  console.log(chalk.green(`\n[OK] ${result.choice.emoji} ${result.choice.label}`));
  console.log(`\n${result.result}`);

  if (result.hpChange !== 0) {
    const color = result.hpChange < 0 ? chalk.red : chalk.green;
    console.log(color(`\nHP ${result.hpChange > 0 ? '+' : ''}${result.hpChange}`));
  }

  if (result.itemGained) {
    console.log(chalk.yellow(`\nObtained: ${result.itemGained.name}`));
  }
}

export function printSpendingSummary(
  spending: ChoiceResult['spending'],
  txHash: string,
): void {
  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.bold('Transaction Summary:'));
  console.log(`  This transaction:  ${spending.thisTx}`);
  console.log(`  Total spent:       ${spending.totalSpent}`);
  console.log(
    chalk.green.bold(`  Gas paid:          ${spending.gasSpent}`) +
      chalk.gray(' (gasless!)'),
  );
  console.log(chalk.gray(`  TX: ${txHash.substring(0, 30)}...`));
  console.log(chalk.gray('─'.repeat(50)));
}

// ============================================================================
// GAME OVER
// ============================================================================

export function printGameOver(
  ending: 'victory' | 'defeat',
  status: GameStatus['status'],
): void {
  if (ending === 'victory') {
    console.log(
      chalk.green.bold(`
+===============================================+
|                                               |
|              * * * VICTORY * * *              |
|                                               |
|        You conquered the Digital Dungeon!     |
|                                               |
+===============================================+
`),
    );
  } else {
    console.log(
      chalk.red.bold(`
+===============================================+
|                                               |
|                 GAME OVER                     |
|                                               |
|       The dungeon claims another soul...      |
|                                               |
+===============================================+
`),
    );
  }

  console.log(chalk.bold('\nFinal Statistics:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Choices Made:   ${status.choicesMade}`);
  console.log(`  HP Remaining:   ${status.hp}`);
  console.log(chalk.green(`  Total Spent:    ${status.totalSpent}`));
  console.log(
    chalk.cyan.bold(`  Gas Paid:       ${status.gasSpent}`) + chalk.gray(' (gasless!)'),
  );
  console.log(chalk.gray('─'.repeat(40)));
}

// ============================================================================
// PAYMENT PROGRESS
// ============================================================================

export function printPaymentStep(step: string): void {
  console.log(chalk.blue(`[...] ${step}`));
}

export function printError(message: string): void {
  console.log(chalk.red(`[ERROR] ${message}`));
}

// ============================================================================
// WELCOME SCREEN
// ============================================================================

export function printWelcome(walletAddress: string, serverUrl: string): void {
  console.log(
    chalk.cyan(`
+===============================================+
|                                               |
|         THE DIGITAL DUNGEON                   |
|                                               |
|    A Pay-to-Play Adventure Demo               |
|    Using x402 Micropayments                   |
|                                               |
+===============================================+
`),
  );

  console.log(`
Each choice costs a tiny micropayment.
All payments are gasless via batched settlement.

Wallet: ${chalk.yellow(walletAddress)}
Server: ${chalk.blue(serverUrl)}
`);
}
