# Cross-Chain Atomic Swap Contracts

This project contains smart contracts for cross-chain atomic swaps, converted from Foundry to Hardhat for easier hackathon development.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy (update deployment script as needed)
npm run deploy
```

## 🏠 Local Development with Hardhat Node

### Prerequisites
- Node.js and npm installed
- Dependencies installed (`npm install`)

### Step 1: Start Local Hardhat Node
```bash
# Start a local Hardhat node (keeps running)
npx hardhat node
```
This will:
- Start a local blockchain on `http://localhost:8545`
- Create 20 test accounts with 10,000 ETH each
- Show account addresses and private keys
- Display all transactions in real-time

### Step 2: Automated Workflow

Our scripts use an automated configuration system that eliminates manual copy-pasting:

#### 🏭 Deploy Contracts
```bash
# In a new terminal (keep the node running)
npx hardhat run scripts/deploy.ts --network localhost
```
**What it does:**
- Deploys EscrowFactory, Access Token, and Test Token
- Mints test tokens to the deployer
- **Saves all addresses to `deployments/deployment-info.json`**
- Shows Etherscan links and next steps

#### 📋 Create Escrow
```bash
npx hardhat run scripts/interact.ts --network localhost
```
**What it does:**
- **Automatically reads contract addresses from deployment file**
- Creates a test escrow with 10 ETH + 0.5 ETH safety deposit
- Configures 1-minute withdrawal period for fast testing
- **Saves escrow details to `deployments/escrow-info.json`**
- Shows timing and next steps

#### 💸 Complete Withdrawal
```bash
# Wait 1 minute for withdrawal period, then:
npx hardhat run scripts/interact_maker.ts --network localhost
```
**What it does:**
- **Automatically reads escrow info from file**
- Executes withdrawal with proper account (taker)
- Transfers 10 ETH to maker, 0.5 ETH safety deposit to taker
- **Saves withdrawal results to `deployments/withdrawal-result.json`**

#### 📊 Check Status Anytime
```bash
npx hardhat run scripts/status.ts --network localhost
```
**What it shows:**
- Deployment status with contract addresses
- Escrow status with timing and balances
- Withdrawal status with transaction details
- **Real-time timelock calculations**
- Suggested next steps

### 🔄 Configuration Files System

The automated workflow uses JSON files in the `deployments/` directory:

- **`deployment-info.json`** - Contract addresses and configuration
- **`escrow-info.json`** - Escrow details and immutables
- **`withdrawal-result.json`** - Withdrawal transaction results

**Benefits:**
- ✅ No manual copy-pasting of addresses
- ✅ No configuration errors
- ✅ Files override on re-runs
- ✅ Easy to reset stages (delete specific files)
- ✅ Perfect for iterative development

### 🎯 Complete Example Workflow

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Complete atomic swap
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/interact.ts --network localhost

# Check status
npx hardhat run scripts/status.ts --network localhost

# Wait 1 minute, then complete the swap
npx hardhat run scripts/interact_maker.ts --network localhost

# Final status
npx hardhat run scripts/status.ts --network localhost
```

### 🔧 Development Tips

**Reset Workflow:**
```bash
# Delete all config files to start fresh
rm -rf deployments/

# Or delete specific stages:
rm deployments/escrow-info.json        # Reset to deployment stage
rm deployments/withdrawal-result.json  # Reset to escrow stage
```

**Multiple Test Cycles:**
- The deploy script will override existing contracts
- Each run creates fresh contracts with new addresses
- Configuration files are automatically updated

**Debugging:**
- Use `scripts/status.ts` to check current state
- All transaction hashes are saved in config files
- Real-time transaction logs appear in the node terminal

## 📝 Changes Made

### Migration from Foundry to Hardhat
- ✅ **Updated package.json** - Added OpenZeppelin contracts and npm scripts
- ✅ **Updated imports** - Changed from Foundry-style to npm-style imports:
  - `openzeppelin-contracts/` → `@openzeppelin/contracts/`
  - `solidity-utils/` → Local implementations or OpenZeppelin equivalents
- ✅ **Created AddressLib** - Simple replacement for 1inch's solidity-utils AddressLib
- ✅ **Updated SafeERC20** - Now using OpenZeppelin's SafeERC20
- ✅ **Fixed Solidity versions** - Configured Hardhat to support both 0.8.23 and 0.8.28
- ✅ **Automated Scripts** - Added configuration file system for seamless development

### Key Contracts
- `EscrowDst.sol` - Destination chain escrow for locking/unlocking funds
- `BaseEscrow.sol` - Base escrow functionality with modifiers and validations
- `Escrow.sol` - Abstract escrow with immutable validation logic
- `libraries/AddressLib.sol` - Custom Address type utilities (simplified)
- `libraries/TimelocksLib.sol` - Timelock management utilities
- `libraries/ImmutablesLib.sol` - Immutable data handling

## 🛠 Development

### For Hackathon Development
1. **Simplifications made**: Removed complex 1inch dependencies in favor of standard OpenZeppelin
2. **Ready to extend**: Add your features to the existing escrow logic
3. **Test-ready**: Existing test framework works out of the box
4. **Local-first**: Complete workflow optimized for local development

### Next Steps
- Implement your custom logic in the escrow contracts
- Add deployment scripts in `ignition/modules/`
- Extend tests for your specific use case
- Consider adding factory contracts for easier deployment

### Dependencies
- **@openzeppelin/contracts** - Standard library for secure smart contract development
- **hardhat** - Development environment with built-in testing and deployment tools

## 📚 Architecture

The contracts implement a cross-chain atomic swap pattern:
1. **Source Chain**: Initiates the swap with a hashlock
2. **Destination Chain**: Locks funds until secret is revealed
3. **Settlement**: Secret revelation unlocks funds on both chains

### Atomic Swap Flow
1. **Deployment**: Factory and tokens deployed
2. **Escrow Creation**: Taker creates escrow with funds locked
3. **Withdrawal Period**: Time-locked withdrawal windows
4. **Secret Revelation**: Taker withdraws with secret, revealing it on-chain
5. **Cross-chain Completion**: Secret can now be used on other chains

## 🔧 Configuration

Hardhat is configured to support multiple Solidity versions for maximum compatibility.
Check `hardhat.config.ts` for current settings.

### Network Configuration
- **localhost**: Local Hardhat node (http://localhost:8545)
- **sepolia**: Ethereum testnet (configure in .env)

### Environment Variables
Create a `.env` file for testnet deployment:
```env
SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
```
