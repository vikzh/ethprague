/**
 * 🪙 TON-EVM ERC20 Atomic Swap - Taker Response Script
 * 
 * This script allows a TAKER to respond to a MAKER's atomic swap offer.
 * 
 * 🔄 Correct Atomic Swap Flow:
 * 1. ✅ MAKER creates source escrow (TON) with TON tokens + secret hash (MAKER INITIATES)
 * 2. 🎯 TAKER creates destination escrow (EVM) with ERC20 tokens (THIS SCRIPT - TAKER RESPONDS)
 * 3. 🎯 MAKER withdraws ERC20 tokens from destination escrow using secret (reveals secret)
 * 4. 🔐 TAKER uses revealed secret to claim TON from source escrow
 * 
 * 💰 Cost Comparison:
 * - ETH Swap:        ~10.51 ETH total (10 ETH swap + 0.5 ETH safety + 0.01 ETH fee)
 * - ERC20 Swap:      ~0.0003 ETH total (0.0002 ETH safety + 0.0001 ETH fee)
 * - Savings:         99.997% cheaper! Perfect for testing even on mainnet!
 * 
 * 🎯 What this script does:
 * 1. Reads deployment info from deployments/deployment-info.json
 * 2. Mints test tokens for the swap (simulating taker having tokens)
 * 3. Creates ERC20 destination escrow requiring only 0.0003 ETH total
 * 4. Saves escrow details to deployments/escrow-info.json for withdrawal script
 * 
 * 🚀 Usage:
 * npx hardhat run scripts/interact.ts --network sepolia
 * TAKER_ADDRESS=0x1234... MAKER_ADDRESS=0x5678... npx hardhat run scripts/interact.ts --network sepolia
 * 
 * 🔧 Environment Variables:
 * - TAKER_ADDRESS: Direct taker address (optional, defaults to account index 1)
 * - MAKER_ADDRESS: Direct maker address (optional, defaults to account index 2)
 * 
 * 💡 For testnets like Sepolia, use environment variables to specify funded addresses
 * 
 * ✨ Ultra-affordable testing on any network - even mainnet!
 */

import { ethers } from "hardhat";
import { EscrowFactory, EscrowDst, MockERC20 } from "../typechain-types";
import * as fs from 'fs';
import * as path from 'path';

// Load deployment info
function loadDeploymentInfo() {
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'deployment-info.json');
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ Deployment info not found at ${deploymentPath}. Please run deployment script first.`);
  }
  
  const deploymentData = fs.readFileSync(deploymentPath, 'utf8');
  return JSON.parse(deploymentData);
}

async function main() {
  console.log("🧪 Testing Deployed TON-EVM Atomic Swap Contracts");
  console.log("=================================================");

  // Load deployment configuration
  const deploymentInfo = loadDeploymentInfo();
  console.log("📄 Loaded deployment info from:", new Date(deploymentInfo.deploymentTime));
  console.log("🌐 Network:", deploymentInfo.network, `(Chain ID: ${deploymentInfo.chainId})`);

  // Extract contract addresses from deployment info
  const FACTORY_ADDRESS = deploymentInfo.contracts.escrowFactory;
  const ACCESS_TOKEN_ADDRESS = deploymentInfo.contracts.accessToken;
  const TEST_TOKEN_ADDRESS = deploymentInfo.contracts.testToken;
  const WITHDRAWAL_PERIOD = deploymentInfo.configuration.withdrawalPeriod;

  // Account selection with environment variable support
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  // Dynamic taker selection
  let taker: any;
  if (process.env.TAKER_ADDRESS) {
    const takerAddress = process.env.TAKER_ADDRESS;
    if (!ethers.isAddress(takerAddress)) {
      throw new Error(`❌ Invalid TAKER_ADDRESS: ${takerAddress}`);
    }
    const matchingSigner = signers.find(s => s.address.toLowerCase() === takerAddress.toLowerCase());
    if (!matchingSigner) {
      throw new Error(`❌ TAKER_ADDRESS ${takerAddress} not found in available signers`);
    }
    taker = matchingSigner;
  } else {
    taker = signers[1]; // Default to user1
  }
  
  // Dynamic maker selection
  let maker: any;
  if (process.env.MAKER_ADDRESS) {
    const makerAddress = process.env.MAKER_ADDRESS;
    if (!ethers.isAddress(makerAddress)) {
      throw new Error(`❌ Invalid MAKER_ADDRESS: ${makerAddress}`);
    }
    const matchingSigner = signers.find(s => s.address.toLowerCase() === makerAddress.toLowerCase());
    if (!matchingSigner) {
      throw new Error(`❌ MAKER_ADDRESS ${makerAddress} not found in available signers`);
    }
    maker = matchingSigner;
  } else {
    maker = signers[2]; // Default to user2
  }
  
  console.log("👤 Testing with accounts:");
  console.log("   - Deployer:", deployer.address);
  console.log("   - Taker:", taker.address, process.env.TAKER_ADDRESS ? "(from TAKER_ADDRESS)" : "(default)");
  console.log("   - Maker:", maker.address, process.env.MAKER_ADDRESS ? "(from MAKER_ADDRESS)" : "(default)");

  // Connect to deployed contracts
  const factory = await ethers.getContractAt("EscrowFactory", FACTORY_ADDRESS) as EscrowFactory;
  const accessToken = await ethers.getContractAt("MockERC20", ACCESS_TOKEN_ADDRESS) as MockERC20;
  const testToken = await ethers.getContractAt("MockERC20", TEST_TOKEN_ADDRESS) as MockERC20;

  console.log("\n🔗 Connected to contracts:");
  console.log("   - Factory:", await factory.getAddress());
  console.log("   - Access Token:", await accessToken.getAddress());
  console.log("   - Test Token:", await testToken.getAddress());

  // Test configuration - Updated for ERC20 swaps to save ETH
  const SECRET = ethers.keccak256(ethers.toUtf8Bytes("sepolia-erc20-test-secret-123"));
  const HASHLOCK = ethers.keccak256(SECRET);
  
  // ERC20 swap parameters (much more cost-effective)
  const TOKEN_AMOUNT = ethers.parseEther("1000"); // 1000 test tokens (free to mint)
  const SAFETY_DEPOSIT = ethers.parseEther("0.0002"); // Ultra-small ETH safety deposit (100x cheaper!)
  const CREATION_FEE = await factory.creationFee();

  console.log("\n🔧 Test Parameters (Ultra-Cheap ERC20 Swap):");
  console.log("   - Secret:", SECRET);
  console.log("   - Hashlock:", HASHLOCK);
  console.log("   - Token Amount:", ethers.formatEther(TOKEN_AMOUNT), "TEST");
  console.log("   - Safety Deposit:", ethers.formatEther(SAFETY_DEPOSIT), "ETH (ultra-low!)");
  console.log("   - Creation Fee:", ethers.formatEther(CREATION_FEE), "ETH");
  console.log(`   ⚡ Fast testing: ${WITHDRAWAL_PERIOD / 60}-minute withdrawal period`);
  console.log("   💡 Total ETH needed:", ethers.formatEther(SAFETY_DEPOSIT + CREATION_FEE), "ETH (100x cheaper!)");
  console.log("   🎯 Cost comparison: ~0.0003 ETH vs 10.51 ETH for ETH swaps (99.997% savings!)");

  // Helper to convert address to Address type (uint256)
  function makeAddressType(addr: string): bigint {
    return BigInt(addr);
  }

  // Create immutables for the test escrow - Updated for ERC20
  function createTestImmutables() {
    const now = Math.floor(Date.now() / 1000);
    
    // Destination chain timelock offsets (in seconds from deployment)
    const dstWithdrawal = WITHDRAWAL_PERIOD;       // Fast testing from config
    const dstPublicWithdrawal = 1800;  // 30 minutes
    const dstCancellation = 3600;      // 1 hour

    // Pack timelocks (will be updated with actual deployment time by factory)
    const timelocks = (BigInt(now) << 224n) |
                     (BigInt(dstCancellation) << 64n) |
                     (BigInt(dstPublicWithdrawal) << 32n) |
                     BigInt(dstWithdrawal);

    return {
      orderHash: ethers.keccak256(ethers.toUtf8Bytes("sepolia-erc20-test-order-1")),
      hashlock: HASHLOCK,
      maker: makeAddressType(maker.address),
      taker: makeAddressType(taker.address),
      token: makeAddressType(TEST_TOKEN_ADDRESS), // ERC20 token instead of ETH
      amount: TOKEN_AMOUNT,
      safetyDeposit: SAFETY_DEPOSIT,
      timelocks: timelocks
    };
  }

  try {
    // Test 1: Check balances
    console.log("\n💰 Step 1: Checking balances...");
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    const takerBalance = await ethers.provider.getBalance(taker.address);
    const totalETHNeeded = SAFETY_DEPOSIT + CREATION_FEE;
    
    console.log("   - Deployer balance:", ethers.formatEther(deployerBalance), "ETH");
    console.log("   - Taker balance:", ethers.formatEther(takerBalance), "ETH");
    console.log("   - Total ETH needed for taker:", ethers.formatEther(totalETHNeeded), "ETH");

    if (takerBalance < totalETHNeeded) {
      throw new Error(`Taker has insufficient ETH! Need ${ethers.formatEther(totalETHNeeded)} ETH, have ${ethers.formatEther(takerBalance)} ETH`);
    }

    // Test 2: Setup tokens for ERC20 swap
    console.log("\n🪙 Step 2: Setting up ERC20 tokens...");
    
    // Mint access tokens for both participants
    await accessToken.mint(taker.address, ethers.parseEther("10"));
    await accessToken.mint(maker.address, ethers.parseEther("10"));
    
    // IMPORTANT: Taker provides the ERC20 tokens in atomic swap
    // Taker has ERC20 tokens and wants TON
    await testToken.mint(taker.address, TOKEN_AMOUNT);
    console.log("   ✅ Minted", ethers.formatEther(TOKEN_AMOUNT), "test tokens to TAKER");
    
    // Taker approves factory to spend their test tokens
    await testToken.connect(taker).approve(await factory.getAddress(), TOKEN_AMOUNT);
    console.log("   ✅ TAKER approved factory to spend test tokens");
    
    const takerAccessBalance = await accessToken.balanceOf(taker.address);
    const takerTokenBalance = await testToken.balanceOf(taker.address);
    const makerAccessBalance = await accessToken.balanceOf(maker.address);
    console.log("   ✅ Taker access token balance:", ethers.formatEther(takerAccessBalance));
    console.log("   ✅ Taker test token balance:", ethers.formatEther(takerTokenBalance));
    console.log("   ✅ Maker access token balance:", ethers.formatEther(makerAccessBalance));

    // Test 3: Create escrow via factory (ERC20 swap) - TAKER CREATES IT
    console.log("\n🚀 Step 3: TAKER creating ERC20 escrow via factory...");
    const immutables = createTestImmutables();
    const totalETHRequired = SAFETY_DEPOSIT + CREATION_FEE; // Only ETH for safety + fees
    
    console.log("   - Token Amount (provided by taker):", ethers.formatEther(TOKEN_AMOUNT), "TEST");
    console.log("   - ETH Required (safety + fee):", ethers.formatEther(totalETHRequired), "ETH");
    console.log("   💡 Taker provides tokens, maker will withdraw them!");
    
    // TAKER creates the destination escrow
    const tx = await factory.connect(taker).createDstEscrow(immutables, {
      value: totalETHRequired
    });
    
    const receipt = await tx.wait();
    console.log("   ✅ Escrow creation tx:", receipt?.hash);

    // Find the escrow address from events
    const events = await factory.queryFilter(factory.filters.DstEscrowCreated());
    const latestEvent = events[events.length - 1];
    const escrowAddress = latestEvent.args.escrow;
    
    console.log("   📍 Escrow deployed at:", escrowAddress);

    // Get the actual deployment timestamp from the blockchain
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const actualDeploymentTime = block?.timestamp || 0;

    // Create correct immutables with actual deployment timestamp
    const dstWithdrawal = WITHDRAWAL_PERIOD;
    const dstPublicWithdrawal = 1800;
    const dstCancellation = 3600;

    const correctTimelocks = (BigInt(actualDeploymentTime) << 224n) |
                            (BigInt(dstCancellation) << 64n) |
                            (BigInt(dstPublicWithdrawal) << 32n) |
                            BigInt(dstWithdrawal);

    const correctImmutables = {
      orderHash: immutables.orderHash,
      hashlock: immutables.hashlock,
      maker: immutables.maker,
      taker: immutables.taker,
      token: immutables.token,
      amount: immutables.amount,
      safetyDeposit: immutables.safetyDeposit,
      timelocks: correctTimelocks
    };

    // Create escrow info object
    const escrowInfo = {
      escrowAddress: escrowAddress,
      transactionHash: receipt?.hash,
      blockNumber: receipt?.blockNumber,
      deploymentTimestamp: actualDeploymentTime,
      deploymentTime: new Date(actualDeploymentTime * 1000).toISOString(),
      secret: SECRET,
      hashlock: HASHLOCK,
      participants: {
        deployer: deployer.address,
        taker: taker.address, // Taker created escrow and provided tokens
        maker: maker.address  // Maker will withdraw tokens using secret
      },
      token: {
        address: TEST_TOKEN_ADDRESS,
        symbol: "TEST",
        name: "Test Token"
      },
      amounts: {
        swapAmount: TOKEN_AMOUNT.toString(),
        safetyDeposit: SAFETY_DEPOSIT.toString(),
        creationFee: CREATION_FEE.toString()
      },
      immutables: {
        orderHash: correctImmutables.orderHash,
        hashlock: correctImmutables.hashlock,
        maker: correctImmutables.maker.toString(),
        taker: correctImmutables.taker.toString(),
        token: correctImmutables.token.toString(),
        amount: correctImmutables.amount.toString(),
        safetyDeposit: correctImmutables.safetyDeposit.toString(),
        timelocks: correctImmutables.timelocks.toString()
      },
      timelock: {
        withdrawalOpensAt: actualDeploymentTime + dstWithdrawal,
        publicWithdrawalOpensAt: actualDeploymentTime + dstPublicWithdrawal,
        cancellationOpensAt: actualDeploymentTime + dstCancellation
      },
      metadata: {
        network: deploymentInfo.network,
        chainId: deploymentInfo.chainId,
        createdAt: new Date().toISOString(),
        swapType: "ERC20",
        economicFlow: {
          takerProvides: "ERC20 tokens + ETH safety deposit",
          takerReceives: "TON (on TON blockchain)",
          makerProvides: "TON (on TON blockchain)", 
          makerReceives: "ERC20 tokens (from this escrow)"
        }
      }
    };

    // Save escrow info to file
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const escrowPath = path.join(deploymentsDir, 'escrow-info.json');
    fs.writeFileSync(escrowPath, JSON.stringify(escrowInfo, null, 2));

    // Test 4: Verify escrow funding
    console.log("\n🔍 Step 4: Verifying escrow funding...");
    const escrowETHBalance = await ethers.provider.getBalance(escrowAddress);
    const escrowTokenBalance = await testToken.balanceOf(escrowAddress);
    
    console.log("   - Escrow ETH balance:", ethers.formatEther(escrowETHBalance), "ETH");
    console.log("   - Escrow token balance:", ethers.formatEther(escrowTokenBalance), "TEST");
    
    const expectedETHBalance = SAFETY_DEPOSIT;
    const expectedTokenBalance = TOKEN_AMOUNT;
    
    if (escrowETHBalance === expectedETHBalance && escrowTokenBalance === expectedTokenBalance) {
      console.log("   ✅ Escrow properly funded with both ETH and tokens");
    } else {
      console.log("   ❌ Escrow funding mismatch");
    }

    // Test 5: Predict next escrow address  
    console.log("\n🔮 Step 5: Testing address prediction...");
    const nextImmutables = createTestImmutables();
    const predictedAddress = await factory.addressOfEscrowDst(nextImmutables);
    console.log("   🔮 Next predicted address:", predictedAddress);

    console.log("\n🎉 CORRECT ATOMIC SWAP ESCROW CREATION COMPLETE!");
    console.log("=================================================");
    console.log("\n📋 Test Results:");
    console.log("   ✅ Factory connection successful");
    console.log("   ✅ TAKER created ERC20 escrow successfully");
    console.log("   ✅ TAKER provided ERC20 tokens + ETH safety deposit");
    console.log("   📍 Active escrow:", escrowAddress);
    console.log("   🪙 Swap type: TAKER's ERC20 → MAKER's TON");
    console.log("   💰 ETH cost for taker:", ethers.formatEther(totalETHRequired), "ETH");
    console.log("   🎯 Savings: 99.997% cheaper than ETH swaps!");
    
    console.log("\n💾 Escrow info saved to:", escrowPath);
    console.log("📄 Maker withdrawal script will automatically read from this file");
    
    console.log("\n🎯 Correct Atomic Swap Flow:");
    console.log(`   1. ✅ MAKER creates source escrow (TON) with TON tokens + secret hash (MAKER INITIATES)`);
    console.log(`   2. 🎯 TAKER creates destination escrow (EVM) with ERC20 tokens (THIS SCRIPT - TAKER RESPONDS)`);
    console.log(`   3. 🎯 MAKER withdraws ERC20 tokens from destination escrow using secret (reveals secret)`);
    console.log(`   4. 🔐 TAKER uses revealed secret to claim TON from source escrow`);
    
    console.log("\n🛠️ Next Actions:");
    console.log(`   1. Wait ${WITHDRAWAL_PERIOD / 60} minute(s) for withdrawal period`);
    console.log("   2. Run maker withdrawal script to withdraw ERC20 tokens");
    console.log("   3. Run taker safety deposit withdrawal");

    return escrowInfo;

  } catch (error) {
    console.error("\n❌ Interaction test failed:");
    console.error(error);
    throw error;
  }
}

main()
  .then((result) => {
    console.log("\n✅ Interaction test successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Interaction test failed:");
    console.error(error);
    process.exit(1);
  }); 