export const WITHDRAWAL_CHAINS = [
  { value: "arcTestnet", label: "Arc Testnet" },
  { value: "avalancheFuji", label: "Avalanche Fuji" },
  { value: "baseSepolia", label: "Base Sepolia" },
  { value: "ethereumSepolia", label: "Ethereum Sepolia" },
  { value: "hyperevmTestnet", label: "HyperEVM Testnet" },
  { value: "seiAtlantic", label: "Sei Atlantic" },
  { value: "solanaDevnet", label: "Solana Devnet" },
  { value: "sonicTestnet", label: "Sonic Testnet" },
  { value: "worldChainSepolia", label: "World Chain Sepolia" },
] as const

export type WithdrawalChain = (typeof WITHDRAWAL_CHAINS)[number]["value"]
