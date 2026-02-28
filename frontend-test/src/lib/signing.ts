import {
  type Hex,
  type Address,
  getAddress,
  erc20Abi,
  parseUnits,
  formatUnits,
} from "viem";
import { createClients, ARC_USDC_ADDRESS, ARC_GATEWAY_WALLET } from "./wallet";

// EIP-712 types for TransferWithAuthorization (from BatchEvmScheme)
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

function createNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

/**
 * Sign an x402 payment payload. Replicates BatchEvmScheme.createPaymentPayload().
 */
export async function signX402Payment(
  privateKey: Hex,
  payTo: Address,
  amountAtomic: string,
  verifyingContract: Address,
  chainId: number,
  maxTimeoutSeconds: number = 345600
) {
  const { account } = createClients(privateKey);
  const nonce = createNonce();
  const now = Math.floor(Date.now() / 1000);

  const authorization = {
    from: account.address,
    to: getAddress(payTo),
    value: amountAtomic,
    validAfter: (now - 600).toString(),
    validBefore: (now + maxTimeoutSeconds).toString(),
    nonce,
  };

  const signature = await account.signTypedData({
    domain: {
      name: "GatewayWalletBatched",
      version: "1",
      chainId,
      verifyingContract: getAddress(verifyingContract),
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: 2,
    payload: { authorization, signature },
  };
}

// GatewayWallet deposit ABI
const GATEWAY_WALLET_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * Deposit USDC from wallet into Gateway contract. Replicates GatewayClient.deposit().
 */
export async function deposit(privateKey: Hex, amount: string) {
  const { account, publicClient, walletClient } = createClients(privateKey);
  const depositAmount = parseUnits(amount, 6);

  const balance = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance < depositAmount) {
    throw new Error(
      `Insufficient USDC. Have: ${formatUnits(balance, 6)}, Need: ${amount}`
    );
  }

  // Approve if needed
  const allowance = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ARC_GATEWAY_WALLET],
  });

  if (allowance < depositAmount) {
    const approveTx = await walletClient.writeContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [ARC_GATEWAY_WALLET, depositAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  const depositTx = await walletClient.writeContract({
    address: ARC_GATEWAY_WALLET,
    abi: GATEWAY_WALLET_ABI,
    functionName: "deposit",
    args: [ARC_USDC_ADDRESS, depositAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });

  return { depositTxHash: depositTx, amount: depositAmount };
}
