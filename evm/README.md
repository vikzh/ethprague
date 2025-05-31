# TON-EVM Cross-Chain Atomic Swap Smart Contracts

## 🌟 **Multi-Token Atomic Swaps: TON ↔ EVM**

Complete smart contract system for **trustless atomic swaps** between TON blockchain and EVM chains (Ethereum, Polygon, BSC, etc.). Supports both **ETH and ANY ERC20 token** swaps with automatic liquidity resolution.

### 🪙 **Supported Swap Types**
- **TON → ETH**: Direct native token swaps
- **TON → ERC20**: Swap TON for any ERC20 token (USDT, USDC, DAI, WETH, UNI, LINK, AAVE, etc.)
- **Cost-Effective Testing**: Use ERC20 swaps to minimize ETH costs during development

## ✨ Features

- ⚡ **Universal Token Support**: Works with ANY ERC20 token without modifications
- 🔒 **Atomic Guarantees**: Either both sides complete or both fail
- 🏭 **Deterministic Deployment**: CREATE2 for predictable escrow addresses  
- ⏰ **Flexible Timelocks**: Private → Public → Cancellation windows
- 🛡️ **Safety Deposits**: Economic security for all participants
- 🔧 **Automated Configuration**: File-based deployment system eliminates manual setup
- 💰 **Cost-Efficient**: Minimal ETH required for ERC20 swaps (only safety deposits + fees)

## 🏗️ Architecture

### Core Contracts
- **`EscrowFactory.sol`**: Deploys and manages destination escrows
- **`EscrowDst.sol`**: Destination chain escrow with withdrawal logic
- **`BaseEscrow.sol`**: Base functionality and security modifiers

### Key Features
- **Multi-token Support**: Set `immutables.token` to any ERC20 address
- **Decimal Handling**: Automatic support for 6-decimal (USDT/USDC) and 18-decimal tokens
- **Gas Optimization**: Only ETH needed for safety deposits in ERC20 swaps
- **Creator Flexibility**: Makers, resolvers, or anyone can create escrows

## 💰 Cost Comparison

### ETH Swaps (Expensive)
```bash
Swap Amount: 10 ETH     # High cost on testnet/mainnet
Safety Deposit: 0.5 ETH 
Creation Fee: 0.01 ETH
Total ETH Required: 10.51 ETH
```

### ERC20 Swaps (Ultra-Cheap!) ⭐⭐⭐
```bash
Token Amount: 1000 USDC    # Free to mint for testing!
Safety Deposit: 0.0002 ETH # Ultra-minimal ETH cost
Creation Fee: 0.0001 ETH   # Ultra-low fee
Total ETH Required: 0.0003 ETH # 99.997% cheaper!
```

### 🎯 **Cost Analysis**
- **ETH Swaps**: 10.51 ETH (~$25,000+ at current prices)
- **ERC20 Swaps**: 0.0003 ETH (~$0.75 at current prices)
- **Savings**: 99.997% reduction in costs!
- **Perfect for**: Testing even on mainnet without breaking the bank!

## 🚀 Quick Start

### 1. Deploy Contracts
```bash
# Deploy to Sepolia (or any EVM network)
npx hardhat run scripts/deploy.ts --network sepolia
```

### 2. 🌐 **MAKER Creates Source Escrow** (Off-chain - TON blockchain)
```bash
# MAKER creates source escrow on TON blockchain with TON tokens + secret hash
# This posts an "order": "I have X TON, want Y ERC20 tokens"
# (This happens on TON blockchain - not covered by these scripts)
```

### 3. 🏦 **TAKER Responds with Destination Escrow**
```bash
# TAKER sees maker's order and creates destination escrow with requested ERC20 tokens
# Uses only ~0.0003 ETH total for safety deposit + fees
npx hardhat run scripts/interact.ts --network sepolia
```

### 4. 🔄 **Complete the Atomic Swap**
```bash
# Step 1: MAKER withdraws ERC20 tokens and reveals secret
npx hardhat run scripts/maker_withdraw.ts --network sepolia

# Step 2: TAKER uses revealed secret to claim TON (on TON blockchain - off-chain)
# Step 3: TAKER withdraws their ETH safety deposit (optional cleanup)
npx hardhat run scripts/taker_withdraw.ts --network sepolia
```

### 5. Check Results
```bash
# Verify final atomic swap results
npx hardhat run scripts/check_balances.ts --network sepolia
```

## 🚀 **Live Deployments**

### **Sepolia Testnet (Verified Contracts)**

The TON-EVM atomic swap system is deployed and **fully verified** on Sepolia testnet:

| Contract | Address | Status | Etherscan |
|----------|---------|---------|-----------|
| **🏭 EscrowFactory** | `0x969F05a876F3d9A9769B2074E2d0b5c11713F249` | ✅ **VERIFIED** | [📖 View Source](https://sepolia.etherscan.io/address/0x969F05a876F3d9A9769B2074E2d0b5c11713F249#code) |
| **🔧 EscrowDst Implementation** | `0x435Fc4ABEa769b2c25470Ac35C371A2d28889c65` | ✅ **VERIFIED** | [📖 View Source](https://sepolia.etherscan.io/address/0x435Fc4ABEa769b2c25470Ac35C371A2d28889c65#code) |
| **🪙 Access Token** | `0x7a30D0B8966a2E96839AcE2a30AC3b74c37C5f77` | 🔗 **DEPLOYED** | [📄 View Contract](https://sepolia.etherscan.io/address/0x7a30D0B8966a2E96839AcE2a30AC3b74c37C5f77) |
| **🪙 Test Token** | `0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588` | 🔗 **DEPLOYED** | [📄 View Contract](https://sepolia.etherscan.io/address/0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588) |

### **Quick Connect to Sepolia:**

```bash
# Use existing verified contracts on Sepolia
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/your-api-key"
ETHERSCAN_API_KEY="your-etherscan-api-key"

# Test the atomic swap immediately:
npx hardhat run scripts/interact.ts --network sepolia
```

### **Deployment Configuration:**
- **Network**: Sepolia Testnet (Chain ID: 11155111)
- **Creation Fee**: 0.0001 ETH (ultra-low for testing)
- **Withdrawal Period**: 1 minute (fast testing)
- **Safety Deposit**: 0.0002 ETH (minimal cost)
- **Total Cost per Swap**: ~0.0003 ETH (~$0.75)

### **Real Transaction Examples:**
- **📥 Escrow Creation**: [0xa23ff13...](https://sepolia.etherscan.io/tx/0xa23ff13df1d8a68612bf6c8f677b546795be146a6212199aec287e45b7807026)
- **✅ Swap Completion**: [0x501545e...](https://sepolia.etherscan.io/tx/0x501545edb5c33df0a33217f86e0eee5a3d072e33e9fec469bda2b6c60eee1ac8)

**🎯 Ready to use!** The contracts are **verified, tested, and production-ready** on Sepolia testnet.

### **Production Scripts:**

The repository includes a **clean, focused script suite** for production use:
- 📜 **deploy.ts** - Deploy contracts to any network
- 🎯 **interact.ts** - Taker creates destination escrow
- 💰 **maker_withdraw.ts** - Maker withdraws tokens using secret  
- 🏦 **taker_withdraw.ts** - Taker withdraws safety deposit
- 📊 **check_balances.ts** - Verify atomic swap results

All development/debug scripts have been removed for clarity.

### **Contract Verification:**

All core contracts are **publicly verified** on Etherscan, enabling:
- 📖 **Full source code visibility**
- 🔍 **Public security auditing**
- 💻 **Direct contract interaction via Etherscan**
- 🤝 **Community trust and adoption**
- 🔗 **Easy integration for developers**

## 🔄 **Correct Atomic Swap Flow**

### **Maker-Initiated TON ↔ ERC20 Atomic Swap**

**Participants:**
- **Maker**: Has TON, wants ERC20 tokens (INITIATES the swap)
- **Taker**: Has ERC20 tokens, wants TON (RESPONDS to maker's offer)

**✅ Actual Flow:**
1. **🌐 MAKER creates source escrow** (TON blockchain) with TON tokens + secret hash
   - Maker posts an "order": "I have X TON, want Y ERC20 tokens"
   - Maker knows the secret, others only see the hash

2. **👀 TAKER discovers the order** and decides to fulfill it
   - Taker sees: "Maker offers X TON for Y ERC20 tokens"

3. **🏦 TAKER creates destination escrow** (EVM) with requested ERC20 tokens
   - Taker provides the ERC20 tokens maker wants
   - Uses same secret hash from maker's source escrow

4. **🎯 MAKER withdraws from destination escrow** using secret
   - 🪙 **ERC20 tokens transfer to MAKER**
   - 💰 **ETH safety deposit returns to TAKER**  
   - 🔐 **Secret is revealed on EVM blockchain**

5. **🔐 TAKER uses revealed secret** to claim TON from source escrow
   - Taker sees the secret from maker's withdrawal transaction
   - Taker claims TON from the original source escrow

**✅ Result:** Maker gets ERC20 tokens, Taker gets TON - atomic swap complete!

## 📋 Real-World Token Examples

The contracts work with **any ERC20 token**. Here are popular examples:

| Token | Address | Usage |
|-------|---------|-------|
| **USDT** | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | `ethers.parseUnits('100', 6)` |
| **USDC** | `0xA0b86a33E6D8F8881f2B08cfb9c4D30a3Ef67AF3` | `ethers.parseUnits('100', 6)` |
| **DAI** | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | `ethers.parseEther('100')` |
| **WETH** | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `ethers.parseEther('0.5')` |

### Usage Pattern
```javascript
const immutables = {
  // ... other fields
  token: "0xA0b86a33E6D8F8881f2B08cfb9c4D30a3Ef67AF3", // USDC
  amount: ethers.parseUnits("1000", 6), // 1000 USDC
  // ... rest of immutables
};
```

## 🛠️ Development Workflow

### Local Testing (Hardhat Network)
```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Run complete atomic swap flow
npx hardhat run scripts/deploy.ts --network localhost

# Step 1: MAKER creates source escrow (TON) - simulated off-chain
# Step 2: TAKER responds with destination escrow (EVM)
npx hardhat run scripts/interact.ts --network localhost        

# Wait 1 minute (default testing period)
# Step 3: MAKER withdraws ERC20 tokens (reveals secret)
npx hardhat run scripts/maker_withdraw.ts --network localhost  

# Step 4: TAKER uses secret to claim TON (TON) - simulated off-chain
# Step 5: TAKER gets safety deposit back (cleanup)
npx hardhat run scripts/taker_withdraw.ts --network localhost  
```

### Maker Withdrawal Testing
```bash
# Test maker withdrawal (withdraws ERC20 tokens using secret)
npx hardhat run scripts/maker_withdraw.ts --network localhost

# Specify maker by direct address (recommended for testnets)
MAKER_ADDRESS=0x1234... npx hardhat run scripts/maker_withdraw.ts --network sepolia

# Specify different maker account index (for local testing)
MAKER_ACCOUNT_INDEX=2 npx hardhat run scripts/maker_withdraw.ts --network localhost

# Features:
# - MAKER withdraws ERC20 tokens from escrow (reveals secret)
# - Dynamic maker selection via MAKER_ADDRESS or MAKER_ACCOUNT_INDEX
# - Automatic timing verification for withdrawal period
# - Complete balance tracking and verification
# - Saves detailed withdrawal results to deployments/maker-withdrawal-result.json
```

### Taker Safety Deposit Withdrawal Testing
```bash
# Test taker safety deposit withdrawal (final cleanup step)
npx hardhat run scripts/taker_withdraw.ts --network localhost

# Specify taker by direct address (recommended for testnets)
TAKER_ADDRESS=0x1234... npx hardhat run scripts/taker_withdraw.ts --network sepolia

# Specify different taker account index (for local testing)
TAKER_ACCOUNT_INDEX=1 npx hardhat run scripts/taker_withdraw.ts --network localhost

# Features:
# - TAKER withdraws their ETH safety deposit after atomic swap completion
# - Can also handle cancellation scenarios (gets tokens + ETH back)
# - Dynamic taker selection via TAKER_ADDRESS or TAKER_ACCOUNT_INDEX
# - Automatic detection of atomic swap completion status
# - Saves detailed withdrawal results to deployments/taker-withdrawal-result.json
```

### Testnet Testing (Ultra-Cost-Effective)
```bash
# Use ERC20 swaps to minimize ETH costs to almost nothing
npx hardhat run scripts/deploy.ts --network sepolia

# STEP 1: MAKER creates source escrow (TON blockchain) - off-chain step
# MAKER posts order: "I have X TON, want Y ERC20 tokens"

# STEP 2: TAKER responds with destination escrow using specific funded addresses
TAKER_ADDRESS=0x1234... MAKER_ADDRESS=0x5678... npx hardhat run scripts/interact.ts --network sepolia  # Only ~0.0003 ETH needed!

# STEP 3: MAKER completes the swap by withdrawing ERC20 tokens (reveals secret)
MAKER_ADDRESS=0x5678... npx hardhat run scripts/maker_withdraw.ts --network sepolia

# STEP 4: TAKER uses revealed secret to claim TON (TON blockchain) - off-chain step
# STEP 5: TAKER retrieves safety deposit (optional cleanup)
TAKER_ADDRESS=0x1234... npx hardhat run scripts/taker_withdraw.ts --network sepolia

# Environment Variables for Testnet Usage:
# - TAKER_ADDRESS: Address with ETH + ERC20 tokens for taker role (responds to maker's order)
# - MAKER_ADDRESS: Address with ETH balance for maker role (initiates and completes swap)
# - Perfect for Sepolia, Goerli, or any testnet with funded accounts
```

## 🔧 Configuration Files

The system uses automated JSON configuration files:

### `deployments/deployment-info.json`
```json
{
  "contracts": {
    "escrowFactory": "0x...",
    "accessToken": "0x...",
    "testToken": "0x..."
  },
  "network": "sepolia",
  "chainId": 11155111
}
```

### `deployments/escrow-info.json`
```json
{
  "escrowAddress": "0x...",
  "swapType": "ERC20",
  "token": {
    "address": "0x...",
    "symbol": "TEST",
    "name": "Test Token"
  },
  "amounts": {
    "swapAmount": "1000000000000000000000",
    "safetyDeposit": "20000000000000000"
  }
}
```

## 🧪 Testing

### Run Comprehensive Tests
```bash
# Test all token types
npx hardhat test

# Test specific ERC20 functionality
npx hardhat test test/erc20-token-swap.test.ts

# Test factory functionality
npx hardhat test test/EscrowFactory.test.ts
```

### Test Coverage
- ✅ ETH atomic swaps
- ✅ ERC20 atomic swaps (USDC, DAI, WETH)
- ✅ Multi-decimal token support
- ✅ Maker-created escrows
- ✅ Resolver-created escrows
- ✅ Timelock enforcement
- ✅ Access token mechanics
- ✅ Real-world token compatibility

## 🌍 Network Configuration

Add networks to `hardhat.config.ts`:

```javascript
networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY]
  },
  polygon: {
    url: process.env.POLYGON_RPC_URL,
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

## 💡 Pro Tips

### For Ultra-Cost-Effective Development:
1. **Use ERC20 swaps** instead of ETH swaps (99.997% cheaper!)
2. **Test on local Hardhat network** first (free)
3. **Use Sepolia testnet** for integration testing (ultra-cheap)
4. **Even mainnet testing** is affordable at 0.0003 ETH per swap
5. **Mint test tokens** instead of using real assets

### For Production:
1. **Adjust timelock periods** for your use case
2. **Set appropriate safety deposits** for economic security
3. **Consider gas optimizations** for high-frequency usage
4. **Implement off-chain resolver discovery** for better UX

## 📈 Economics

### Resolver Model
- **Resolvers provide liquidity** and earn fees
- **Safety deposits** ensure honest behavior
- **Public withdrawals** allow competition

### Maker-Direct Model
- **Makers create own escrows** for better economics
- **No resolver fees** (only creation fee)
- **Higher capital efficiency**

## 🔍 Security Features

- **CREATE2 deterministic addresses** prevent address manipulation
- **Immutable validation** ensures contract integrity
- **Timelock mechanisms** provide structured withdrawal windows
- **Access token gates** enable controlled public operations
- **Emergency rescue functions** for edge cases

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npx hardhat test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🎯 **Ready for Multi-Token Atomic Swaps!**

This system enables **universal token swaps** between TON and any EVM chain, supporting both ETH and ERC20 tokens with minimal modification required. Perfect for:

- 🏦 **Cross-chain DEX aggregators**
- 💱 **Multi-token bridge protocols** 
- 🧪 **Cost-effective testing and development**
- 🚀 **Production-ready atomic swap infrastructure**

**Get started with ultra-cheap ERC20 swaps today and save 99.997% on testing costs!** 🎉

**💡 At 0.0003 ETH per swap (~$0.75), you can afford to test even on mainnet!**

```bash
# 1. Deploy contracts (once per network)
npx hardhat run scripts/deploy.ts --network sepolia

# 2. Taker responds to maker's offer
npx hardhat run scripts/interact.ts --network sepolia

# 3. Maker withdraws tokens (reveals secret)  
npx hardhat run scripts/maker_withdraw.ts --network sepolia

# 4. Taker withdraws safety deposit
npx hardhat run scripts/taker_withdraw.ts --network sepolia

# 5. Verify results
npx hardhat run scripts/check_balances.ts --network sepolia
```
