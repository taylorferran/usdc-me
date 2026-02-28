/**
 * The Digital Dungeon - Story Content
 *
 * Contains all narrative content, ASCII art, and story structure.
 * Game logic is handled separately in gameService.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Item {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface Choice {
  id: string;
  label: string;
  emoji: string;
  price: string;
  requiresItem?: string;
  grantsItem?: string;
  nextScene: string;
  hpChange?: number;
  resultText: string;
}

export interface Scene {
  id: string;
  title: string;
  chapter: number;
  ascii: string;
  narrative: string;
  choices: Choice[];
  isEnding?: boolean;
  endingType?: 'victory' | 'defeat';
}

// ============================================================================
// ITEMS
// ============================================================================

export const ITEMS: Record<string, Item> = {
  sword: {
    id: 'sword',
    name: 'Ancient Sword',
    emoji: '🗡️',
    description: 'A sharp blade that glows faintly in the dark.',
  },
  shield: {
    id: 'shield',
    name: 'Iron Shield',
    emoji: '🛡️',
    description: 'Heavy but reliable protection.',
  },
  key: {
    id: 'key',
    name: 'Golden Key',
    emoji: '🔑',
    description: 'Opens the sealed treasure vault.',
  },
};

// ============================================================================
// ASCII ART
// ============================================================================

const ASCII_ENTRANCE = `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄            ║
    ║      █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█            ║
    ║      █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█            ║
    ║      █░░░░░▄▄▄▄▄░░░░░░░░░░░░░░░░░▄▄▄▄▄░░░░░░░█            ║ 
    ║      █░░░░░█   █░░░░░░░░░░░░░░░░░█   █░░░░░░░█            ║
    ║      █░░░░░█ ● █░░░THE DIGITAL░░░█ ● █░░░░░░░█            ║
    ║      █░░░░░█   █░░░░░DUNGEON░░░░░█   █░░░░░░░█            ║
    ║      █░░░░░▀▀▀▀▀░░░░░░░░░░░░░░░░░▀▀▀▀▀░░░░░░░█            ║
    ║      █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█            ║
    ║      █▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█            ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝`;

const ASCII_GUARDIAN = `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║                      ▄▄▄███▄▄▄                            ║
    ║                    ▄█████████████▄                        ║
    ║                   ███ ▀▀███▀▀ ███                         ║
    ║                   ███   ███   ███                         ║
    ║                    ▀█▄▄█████▄▄█▀                          ║
    ║                      ▄███████▄                            ║
    ║                   ▄█████████████▄                         ║
    ║                  ███████████████████                      ║
    ║                 ████   █████   ████                       ║
    ║                ████     ███     ████                      ║
    ║               ████      ███      ████                     ║
    ║              ████       ███       ████                    ║
    ║                    STONE GUARDIAN                         ║
    ╚═══════════════════════════════════════════════════════════╝`;

const ASCII_TREASURE = `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║                  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄                        ║
    ║                ▄█████████████████████▄                    ║
    ║               ██ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ ██                    ║
    ║               ██ █    💎  💰  💎    █ ██                  ║
    ║               ██ █    💰  💎  💰    █ ██                  ║
    ║               ██ █    💎  💰  💎    █ ██                  ║
    ║               ██ █▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█ ██                   ║
    ║               █████████████████████████                   ║
    ║                  ████████████████████                     ║
    ║                                                           ║
    ║                   THE TREASURE CHEST                      ║
    ╚═══════════════════════════════════════════════════════════╝`;

const ASCII_ESCAPE = `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║         RUMBLE RUMBLE...                                  ║
    ║                                                           ║
    ║        ▓▓▓▓▓▓▓        ░░░░░░░        ▓▓▓▓▓▓▓              ║
    ║       ▓▓▓▓▓▓▓▓▓      ░░░░░░░░░      ▓▓▓▓▓▓▓▓▓             ║
    ║      ▓▓ LEFT ▓▓     ░░ CENTER ░░    ▓▓ RIGHT ▓            ║
    ║       ▓▓▓▓▓▓▓▓▓      ░░░░░░░░░      ▓▓▓▓▓▓▓▓▓             ║
    ║        ▓▓▓▓▓▓▓        ░░░░░░░        ▓▓▓▓▓▓▓              ║
    ║                                                           ║
    ║                       THE DUNGEON IS COLLAPSING...        ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝`;

const ASCII_VICTORY = `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║                      VICTORY                              ║
    ║                                                           ║
    ║                    ▄▄▄▄▄▄▄▄▄▄▄                            ║
    ║                  ▄████████████▄                           ║
    ║                 ██████████████████                        ║
    ║                █████  YOU  █████                          ║
    ║                █████ ESCAPED █████                        ║
    ║                 ██████████████████                        ║
    ║                  ▀████████████▀                           ║
    ║                    ▀▀▀▀▀▀▀▀▀▀▀                            ║
    ║                                                           ║
    ║      You emerge into the sunlight, treasure in hand!      ║
    ╚═══════════════════════════════════════════════════════════╝`;

const ASCII_DEFEAT = `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║                     GAME OVER                             ║
    ║                                                           ║
    ║                    ▄▄▄▄▄▄▄▄▄▄▄                            ║
    ║                  ▄█████████████▄                          ║
    ║                 ██  ▄▄▄  ▄▄▄  ██                          ║
    ║                 ██  ███  ███  ██                          ║
    ║                 ██     ▄▄     ██                          ║
    ║                 ██   ▀▀▀▀▀▀   ██                          ║
    ║                  ▀█████████████▀                          ║
    ║                    ▀▀▀▀▀▀▀▀▀▀▀                            ║
    ║                                                           ║
    ║            The dungeon claims another adventurer...       ║
    ╚═══════════════════════════════════════════════════════════╝`;

// ============================================================================
// SCENES (3 main scenes + endings)
// ============================================================================

export const SCENES: Record<string, Scene> = {
  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER 1: THE ENTRANCE
  // ─────────────────────────────────────────────────────────────────────────
  entrance: {
    id: 'entrance',
    title: 'The Entrance',
    chapter: 1,
    ascii: ASCII_ENTRANCE,
    narrative: `You stand before the gates of the Digital Dungeon. 
Ancient runes flicker across the stone archway.

A merchant sits by the entrance, weapons laid out on a worn blanket.
"Prepare yourself, traveler. The Guardian within shows no mercy 
to the unprepared."`,
    choices: [
      {
        id: 'buy-sword',
        label: 'Buy Ancient Sword',
        emoji: '🗡️',
        price: '$0.000001',
        grantsItem: 'sword',
        nextScene: 'entrance',
        resultText:
          'The merchant hands you a glowing blade. "This will serve you well against the Guardian."',
      },
      {
        id: 'buy-shield',
        label: 'Buy Iron Shield',
        emoji: '🛡️',
        price: '$0.000001',
        grantsItem: 'shield',
        nextScene: 'entrance',
        resultText:
          'You receive a heavy iron shield. "Block well, and you may survive," the merchant nods.',
      },
      {
        id: 'enter-dungeon',
        label: 'Enter the Dungeon',
        emoji: '🚪',
        price: '$0.000002',
        nextScene: 'guardian',
        resultText:
          'The gates grind open. Cold air rushes out as you step into the darkness...',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER 2: THE GUARDIAN
  // ─────────────────────────────────────────────────────────────────────────
  guardian: {
    id: 'guardian',
    title: 'The Guardian',
    chapter: 2,
    ascii: ASCII_GUARDIAN,
    narrative: `A massive stone golem blocks your path. Its eyes glow with ancient fire,
and runes pulse across its body.

It speaks in a voice like grinding boulders:
"NONE SHALL PASS WITHOUT PROVING THEIR WORTH."`,
    choices: [
      {
        id: 'fight-unarmed',
        label: 'Fight with Bare Hands',
        emoji: '👊',
        price: '$0.000001',
        nextScene: 'fight-wounded',
        resultText: 'You charge at the golem, fists raised...',
      },
      {
        id: 'fight-sword',
        label: 'Fight with Sword',
        emoji: '⚔️',
        price: '$0.000001',
        requiresItem: 'sword',
        nextScene: 'treasure',
        resultText:
          'Your blade finds the gap in its armor! The Guardian crumbles to dust.',
      },
      {
        id: 'block-and-pass',
        label: 'Block and Run Past',
        emoji: '🛡️',
        price: '$0.000001',
        requiresItem: 'shield',
        nextScene: 'treasure',
        hpChange: -20,
        resultText:
          'You raise your shield and dash past! A glancing blow catches you. (-20 HP)',
      },
      {
        id: 'bribe',
        label: 'Offer a Large Bribe',
        emoji: '💰',
        price: '$0.000005',
        nextScene: 'treasure',
        grantsItem: 'key',
        resultText:
          'The Guardian accepts your offering. "WISE CHOICE." It hands you a golden key.',
      },
    ],
  },

  'fight-wounded': {
    id: 'fight-wounded',
    title: 'The Guardian',
    chapter: 2,
    ascii: ASCII_GUARDIAN,
    narrative: `Your fists barely scratch the stone surface. The Guardian's 
massive arm swings, catching you hard.

You manage to slip past while it recovers, but you are badly hurt.`,
    choices: [
      {
        id: 'continue-wounded',
        label: 'Stumble Forward',
        emoji: '🩹',
        price: '$0.000001',
        nextScene: 'treasure',
        hpChange: -50,
        resultText:
          'Gasping for breath, you drag yourself toward the treasure room. (-50 HP)',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER 3: THE TREASURE & ESCAPE
  // ─────────────────────────────────────────────────────────────────────────
  treasure: {
    id: 'treasure',
    title: 'The Treasure Room',
    chapter: 3,
    ascii: ASCII_TREASURE,
    narrative: `Before you sits a legendary treasure chest, overflowing with 
gold and gems. But the room begins to shake...

The dungeon is collapsing! You must grab what you can and escape!`,
    choices: [
      {
        id: 'use-key',
        label: 'Unlock with Golden Key',
        emoji: '🔑',
        price: '$0.000001',
        requiresItem: 'key',
        nextScene: 'victory',
        resultText:
          'The key fits perfectly! You grab the legendary treasure and sprint for the exit!',
      },
      {
        id: 'smash-chest',
        label: 'Smash the Chest Open',
        emoji: '💥',
        price: '$0.000002',
        nextScene: 'escape-choice',
        hpChange: -10,
        resultText:
          'You smash it open but trigger a trap! Spikes graze you. You grab some coins. (-10 HP)',
      },
      {
        id: 'grab-and-run',
        label: 'Grab Loose Coins and Run',
        emoji: '🏃',
        price: '$0.000001',
        nextScene: 'escape-choice',
        resultText: 'You scoop up scattered coins and run for the exit!',
      },
    ],
  },

  'escape-choice': {
    id: 'escape-choice',
    title: 'The Escape',
    chapter: 3,
    ascii: ASCII_ESCAPE,
    narrative: `Three passages lead out. Rocks fall from above.
You have seconds to choose. Which way?`,
    choices: [
      {
        id: 'exit-left',
        label: 'Left Passage',
        emoji: '⬅️',
        price: '$0.000001',
        nextScene: 'defeat',
        hpChange: -100,
        resultText: 'The passage collapses! You are buried under tons of rock.',
      },
      {
        id: 'exit-center',
        label: 'Center Passage',
        emoji: '⬆️',
        price: '$0.000001',
        nextScene: 'victory',
        resultText: 'You sprint through falling debris and burst into daylight!',
      },
      {
        id: 'exit-right',
        label: 'Right Passage',
        emoji: '➡️',
        price: '$0.000001',
        nextScene: 'defeat',
        hpChange: -100,
        resultText: 'A pit opens beneath you! You fall into the abyss.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENDINGS
  // ─────────────────────────────────────────────────────────────────────────
  victory: {
    id: 'victory',
    title: 'Victory!',
    chapter: 4,
    ascii: ASCII_VICTORY,
    narrative: `You burst into the sunlight, treasure in hand!

The Digital Dungeon seals behind you forever.
Tales of your adventure will echo through the ages.`,
    choices: [],
    isEnding: true,
    endingType: 'victory',
  },

  defeat: {
    id: 'defeat',
    title: 'Game Over',
    chapter: 4,
    ascii: ASCII_DEFEAT,
    narrative: `Your adventure ends here.

Perhaps another brave soul will one day claim the treasure...
But it will not be you. Not this time.`,
    choices: [],
    isEnding: true,
    endingType: 'defeat',
  },
};
