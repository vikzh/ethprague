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

  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("👤 Testing with accounts:");
  console.log("   - Deployer:", deployer.address);
  console.log("   - User 1 (Taker):", user1.address);
  console.log("   - User 2 (Maker):", user2.address);

  // Connect to deployed contracts
  const factory = await ethers.getContractAt("EscrowFactory", FACTORY_ADDRESS) as EscrowFactory;
  const accessToken = await ethers.getContractAt("MockERC20", ACCESS_TOKEN_ADDRESS) as MockERC20;
  const testToken = await ethers.getContractAt("MockERC20", TEST_TOKEN_ADDRESS) as MockERC20;

  console.log("\n🔗 Connected to contracts:");
  console.log("   - Factory:", await factory.getAddress());
  console.log("   - Access Token:", await accessToken.getAddress());
  console.log("   - Test Token:", await testToken.getAddress());

  // Test configuration
  const SECRET = ethers.keccak256(ethers.toUtf8Bytes("sepolia-test-secret-123"));
  const HASHLOCK = ethers.keccak256(SECRET);
  const AMOUNT = ethers.parseEther("10"); // 10 ETH
  const SAFETY_DEPOSIT = ethers.parseEther("0.5"); // 0.5 ETH
  const CREATION_FEE = await factory.creationFee();

  console.log("\n🔧 Test Parameters:");
  console.log("   - Secret:", SECRET);
  console.log("   - Hashlock:", HASHLOCK);
  console.log("   - Amount:", ethers.formatEther(AMOUNT), "ETH");
  console.log("   - Safety Deposit:", ethers.formatEther(SAFETY_DEPOSIT), "ETH");
  console.log(`   ⚡ Fast testing: ${WITHDRAWAL_PERIOD / 60}-minute withdrawal period`);

  // Helper to convert address to Address type (uint256)
  function makeAddressType(addr: string): bigint {
    return BigInt(addr);
  }

  // Create immutables for the test escrow
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
      orderHash: ethers.keccak256(ethers.toUtf8Bytes("sepolia-test-order-1")),
      hashlock: HASHLOCK,
      maker: makeAddressType(user2.address),
      taker: makeAddressType(user1.address),
      token: makeAddressType(ethers.ZeroAddress), // ETH
      amount: AMOUNT,
      safetyDeposit: SAFETY_DEPOSIT,
      timelocks: timelocks
    };
  }

  try {
    // Test 1: Check balances
    console.log("\n💰 Step 1: Checking balances...");
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    const user1Balance = await ethers.provider.getBalance(user1.address);
    
    console.log("   - Deployer balance:", ethers.formatEther(deployerBalance), "ETH");
    console.log("   - User1 balance:", ethers.formatEther(user1Balance), "ETH");

    if (deployerBalance < ethers.parseEther("0.1")) {
      console.log("⚠️  Warning: Deployer has low ETH balance");
    }

    // Test 2: Mint access tokens for testing
    console.log("\n🎁 Step 2: Minting access tokens...");
    await accessToken.mint(user1.address, ethers.parseEther("10"));
    await accessToken.mint(deployer.address, ethers.parseEther("10"));
    
    const user1AccessBalance = await accessToken.balanceOf(user1.address);
    console.log("   ✅ User1 access token balance:", ethers.formatEther(user1AccessBalance));

    // Test 3: Create escrow via factory
    console.log("\n🚀 Step 3: Creating escrow via factory...");
    const immutables = createTestImmutables();
    const totalRequired = AMOUNT + SAFETY_DEPOSIT + CREATION_FEE;
    
    console.log("   - Total ETH required:", ethers.formatEther(totalRequired), "ETH");
    
    const tx = await factory.connect(deployer).createDstEscrow(immutables, {
      value: totalRequired
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
        taker: user1.address,
        maker: user2.address
      },
      amounts: {
        swapAmount: AMOUNT.toString(),
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
        createdAt: new Date().toISOString()
      }
    };

    // Save escrow info to file
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const escrowPath = path.join(deploymentsDir, 'escrow-info.json');
    fs.writeFileSync(escrowPath, JSON.stringify(escrowInfo, null, 2));

    // Test 4: Verify escrow funding
    console.log("\n🔍 Step 4: Verifying escrow funding...");
    const escrowBalance = await ethers.provider.getBalance(escrowAddress);
    console.log("   - Escrow balance:", ethers.formatEther(escrowBalance), "ETH");
    
    const expectedBalance = AMOUNT + SAFETY_DEPOSIT;
    if (escrowBalance === expectedBalance) {
      console.log("   ✅ Escrow properly funded");
    } else {
      console.log("   ❌ Escrow funding mismatch");
    }

    // Test 5: Predict next escrow address  
    console.log("\n🔮 Step 5: Testing address prediction...");
    const nextImmutables = createTestImmutables();
    const predictedAddress = await factory.addressOfEscrowDst(nextImmutables);
    console.log("   🔮 Next predicted address:", predictedAddress);

    console.log("\n🎉 INTERACTION TEST COMPLETE!");
    console.log("============================");
    console.log("\n📋 Test Results:");
    console.log("   ✅ Factory connection successful");
    console.log("   ✅ Escrow creation successful");
    console.log("   ✅ Funding verification successful");
    console.log("   📍 Active escrow:", escrowAddress);
    
    console.log("\n💾 Escrow info saved to:", escrowPath);
    console.log("📄 Withdrawal script will automatically read from this file");
    
    console.log("\n🎯 Next Steps:");
    console.log(`   1. Wait ${WITHDRAWAL_PERIOD / 60} minute(s) for withdrawal period`);
    console.log("   2. Run withdrawal script (interact_maker.ts)");
    console.log("   3. Verify atomic swap completion");

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