# Basic Paywall Example

A basic example demonstrating gasless x402 payments with Circle Gateway.
Includes a simple Express server (Seller) and a CLI script (Buyer).

## Prerequisites

- Node.js >= 20
- An EVM private key with some testnet USDC on Arc Testnet
- Get funds: [faucet.circle.com](https://faucet.circle.com)
  - _Need more?_ Use the [Faucet API](https://developers.circle.com/w3s/developer-console-faucet#fund-a-wallet-programmatically) for higher limits.

## Setup

### 1. Set Your Cloudsmith Token

```bash
export CLOUDSMITH_TOKEN=your_token_here
```

> **Private Beta:** This token is provided by the Circle team. If you haven't received one, please contact the team.

> 💡 **Tip:** Add `CLOUDSMITH_TOKEN=your_token_here` to a `.env` file in your project and load it before running npm commands.

### 2. Install Dependencies

```bash
npm install
```

## Running the Example

You will need two terminal windows.

### Terminal 1: Start the Seller Server

```bash
npm run server
```

_Server runs on http://localhost:3002_

### Terminal 2: Run the Buyer Client

1. **Set your private key:**

   ```bash
   export PRIVATE_KEY=0xyour_private_key_here
   ```

2. **Deposit funds to Gateway (One-time):**

   ```bash
   npm run deposit
   ```

3. **Check balances:**

   ```bash
   npm run balances
   ```

4. **Run the buyer client:**
   ```bash
   npm run client
   ```
   _This pays for the protected /paid endpoint using gasless payment._
