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

## 📝 Changes Made

### Migration from Foundry to Hardhat
- ✅ **Updated package.json** - Added OpenZeppelin contracts and npm scripts
- ✅ **Updated imports** - Changed from Foundry-style to npm-style imports:
  - `openzeppelin-contracts/` → `@openzeppelin/contracts/`
  - `solidity-utils/` → Local implementations or OpenZeppelin equivalents
- ✅ **Created AddressLib** - Simple replacement for 1inch's solidity-utils AddressLib
- ✅ **Updated SafeERC20** - Now using OpenZeppelin's SafeERC20
- ✅ **Fixed Solidity versions** - Configured Hardhat to support both 0.8.23 and 0.8.28

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

## 🔧 Configuration

Hardhat is configured to support multiple Solidity versions for maximum compatibility.
Check `hardhat.config.ts` for current settings.
