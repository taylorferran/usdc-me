/**
 * Game Service - State Management & Game Logic
 *
 * Handles all game state operations, separate from the x402 payment logic.
 */

import { SCENES, ITEMS, type Scene, type Choice } from './story';

// ============================================================================
// TYPES
// ============================================================================

export interface GameState {
  currentScene: string;
  inventory: string[];
  hp: number;
  maxHp: number;
  totalSpentUnits: number;
  choicesMade: string[];
  startedAt: string;
}

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
    inventory: Array<{ id: string; name: string; emoji: string }>;
    inventoryDisplay: string;
    choicesMade: number;
    totalSpent: string;
    gasSpent: string;
  };
}

export interface ChoiceResult {
  success: boolean;
  choiceLabel: string;
  choiceEmoji: string;
  resultText: string;
  hpChange: number;
  itemGained: { id: string; name: string; emoji: string } | null;
  spending: {
    thisTx: string;
    totalSpent: string;
    gasSpent: string;
  };
}

// ============================================================================
// STATE STORAGE
// ============================================================================

const gameStates = new Map<string, GameState>();

// ============================================================================
// STATE HELPERS
// ============================================================================

function createGameState(): GameState {
  return {
    currentScene: 'entrance',
    inventory: [],
    hp: 100,
    maxHp: 100,
    totalSpentUnits: 0,
    choicesMade: [],
    startedAt: new Date().toISOString(),
  };
}

function formatHpBar(hp: number, maxHp: number): string {
  const filled = Math.round((hp / maxHp) * 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${hp}/${maxHp}`;
}

function formatInventory(inventory: string[]): string {
  if (inventory.length === 0) return 'Empty';
  return inventory.map((id) => `${ITEMS[id]?.emoji} ${ITEMS[id]?.name || id}`).join(', ');
}

function formatSpent(units: number): string {
  return `$${(units / 1_000_000).toFixed(6)}`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function getOrCreateState(playerAddress: string): GameState {
  const key = playerAddress.toLowerCase();
  if (!gameStates.has(key)) {
    gameStates.set(key, createGameState());
  }
  return gameStates.get(key)!;
}

export function resetState(playerAddress: string): GameState {
  const key = playerAddress.toLowerCase();
  const newState = createGameState();
  gameStates.set(key, newState);
  return newState;
}

export function getGameStatus(playerAddress: string): GameStatus {
  const state = getOrCreateState(playerAddress);
  const scene = SCENES[state.currentScene] || SCENES.entrance;
  const availableChoices = getAvailableChoices(state, scene);

  return {
    scene: {
      id: scene.id,
      title: scene.title,
      chapter: scene.chapter,
      ascii: scene.ascii,
      narrative: scene.narrative,
      isEnding: scene.isEnding || false,
      endingType: scene.endingType,
    },
    choices: availableChoices.map((c, idx) => ({
      index: idx + 1,
      id: c.id,
      label: c.label,
      emoji: c.emoji,
      price: c.price,
    })),
    status: {
      hp: state.hp,
      maxHp: state.maxHp,
      hpBar: formatHpBar(state.hp, state.maxHp),
      inventory: state.inventory.map((id) => ({
        id,
        name: ITEMS[id]?.name || id,
        emoji: ITEMS[id]?.emoji || '📦',
      })),
      inventoryDisplay: formatInventory(state.inventory),
      choicesMade: state.choicesMade.length,
      totalSpent: formatSpent(state.totalSpentUnits),
      gasSpent: '$0.00', // Always zero - this is our value prop!
    },
  };
}

export function findChoice(playerAddress: string, choiceId: string): Choice | null {
  const state = getOrCreateState(playerAddress);
  const scene = SCENES[state.currentScene] || SCENES.entrance;
  const availableChoices = getAvailableChoices(state, scene);
  return availableChoices.find((c) => c.id === choiceId) || null;
}

export function isGameOver(playerAddress: string): boolean {
  const state = getOrCreateState(playerAddress);
  const scene = SCENES[state.currentScene];
  return scene?.isEnding || false;
}

export function applyChoice(
  playerAddress: string,
  choiceId: string,
  paymentAmountUnits: number,
): ChoiceResult {
  const key = playerAddress.toLowerCase();
  const state = getOrCreateState(playerAddress);
  const scene = SCENES[state.currentScene];
  const choice = scene.choices.find((c) => c.id === choiceId);

  if (!choice) {
    throw new Error(`Choice ${choiceId} not found`);
  }

  // Update state
  const newState: GameState = {
    ...state,
    currentScene: choice.nextScene,
    choicesMade: [...state.choicesMade, choiceId],
    hp: Math.max(0, state.hp + (choice.hpChange || 0)),
    totalSpentUnits: state.totalSpentUnits + paymentAmountUnits,
    inventory: choice.grantsItem
      ? [...state.inventory, choice.grantsItem]
      : state.inventory,
  };

  // Check for death
  if (newState.hp <= 0) {
    newState.currentScene = 'defeat';
  }

  gameStates.set(key, newState);

  return {
    success: true,
    choiceLabel: choice.label,
    choiceEmoji: choice.emoji,
    resultText: choice.resultText,
    hpChange: choice.hpChange || 0,
    itemGained: choice.grantsItem
      ? {
          id: choice.grantsItem,
          name: ITEMS[choice.grantsItem]?.name || choice.grantsItem,
          emoji: ITEMS[choice.grantsItem]?.emoji || '📦',
        }
      : null,
    spending: {
      thisTx: formatSpent(paymentAmountUnits),
      totalSpent: formatSpent(newState.totalSpentUnits),
      gasSpent: '$0.00', // Always zero!
    },
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function getAvailableChoices(state: GameState, scene: Scene): Choice[] {
  return scene.choices.filter((choice) => {
    // If choice requires an item, check if player has it
    if (choice.requiresItem && !state.inventory.includes(choice.requiresItem)) {
      return false;
    }
    // If choice grants an item player already has, hide it
    if (choice.grantsItem && state.inventory.includes(choice.grantsItem)) {
      return false;
    }
    return true;
  });
}
