import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

export const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;
export const ARC_GATEWAY_WALLET =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;

export function generatePrivateKey(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

export function getAddressFromKey(privateKey: Hex): Address {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

export function createClients(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
  return { account, publicClient, walletClient };
}
