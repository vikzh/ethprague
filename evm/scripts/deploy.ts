import { ethers } from "hardhat";
import { EscrowFactory, MockERC20 } from "../typechain-types";
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log("🚀 Deploying TON-EVM Atomic Swap Contracts to Sepolia");
  console.log("=================================================");

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.1")) {
    console.log("⚠️  Warning: Low ETH balance. Make sure you have enough ETH for deployment.");
  }

  // Configuration
  const RESCUE_DELAY = 7 * 24 * 60 * 60; // 7 days
  const CREATION_FEE = ethers.parseEther("0.01"); // 0.01 ETH
  const TREASURY_ADDRESS = deployer.address; // Use deployer as treasury for testing
  const WITHDRAWAL_PERIOD = 60; // 1 minute for fast testing

  console.log("\n📊 Deployment Configuration:");
  console.log("   - Rescue Delay:", RESCUE_DELAY, "seconds (7 days)");
  console.log("   - Creation Fee:", ethers.formatEther(CREATION_FEE), "ETH");
  console.log("   - Treasury Address:", TREASURY_ADDRESS);
  console.log("   - Withdrawal Period:", WITHDRAWAL_PERIOD / 60, "minute (for fast testing)");

  // Step 1: Deploy Access Token
  console.log("\n🪙 Step 1: Deploying Access Token...");
  const AccessTokenFactory = await ethers.getContractFactory("MockERC20");
  const accessToken = await AccessTokenFactory.deploy("TON-EVM Access Token", "TEACC");
  await accessToken.waitForDeployment();
  
  const accessTokenAddress = await accessToken.getAddress();
  console.log("   ✅ Access Token deployed at:", accessTokenAddress);

  // Step 2: Deploy EscrowFactory
  console.log("\n🏭 Step 2: Deploying EscrowFactory...");
  const EscrowFactoryFactory = await ethers.getContractFactory("EscrowFactory");
  const factory = await EscrowFactoryFactory.deploy(
    accessTokenAddress, // access token
    deployer.address,   // owner
    RESCUE_DELAY,       // rescue delay
    CREATION_FEE,       // creation fee
    TREASURY_ADDRESS    // treasury
  );
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  const dstImplementationAddress = await factory.ESCROW_DST_IMPLEMENTATION();
  console.log("   ✅ EscrowFactory deployed at:", factoryAddress);
  console.log("   📋 Destination Escrow Implementation:", dstImplementationAddress);

  // Step 3: Deploy Test ERC20 Token (for testing purposes)
  console.log("\n🪙 Step 3: Deploying Test ERC20 Token...");
  const TestTokenFactory = await ethers.getContractFactory("MockERC20");
  const testToken = await TestTokenFactory.deploy("Test USDC", "TUSDC");
  await testToken.waitForDeployment();
  
  const testTokenAddress = await testToken.getAddress();
  console.log("   ✅ Test Token deployed at:", testTokenAddress);

  // Step 4: Mint some test tokens
  console.log("\n🎁 Step 4: Minting test tokens...");
  
  // Mint access tokens
  await accessToken.mint(deployer.address, ethers.parseEther("1000"));
  console.log("   ✅ Minted 1000 access tokens to deployer");
  
  // Mint test tokens
  await testToken.mint(deployer.address, ethers.parseEther("1000000"));
  console.log("   ✅ Minted 1,000,000 test tokens to deployer");

  // Step 5: Verify deployment
  console.log("\n🔍 Step 5: Verifying deployment...");
  const owner = await factory.owner();
  const creationFee = await factory.creationFee();
  const treasury = await factory.treasury();
  
  console.log("   - Factory owner:", owner);
  console.log("   - Creation fee:", ethers.formatEther(creationFee), "ETH");
  console.log("   - Treasury:", treasury);

  // Create deployment info object
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name || "unknown",
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: Math.floor(Date.now() / 1000),
    deploymentTime: new Date().toISOString(),
    contracts: {
      escrowFactory: factoryAddress,
      accessToken: accessTokenAddress,
      testToken: testTokenAddress,
      dstImplementation: dstImplementationAddress
    },
    configuration: {
      rescueDelay: RESCUE_DELAY,
      creationFee: CREATION_FEE.toString(),
      treasuryAddress: TREASURY_ADDRESS,
      withdrawalPeriod: WITHDRAWAL_PERIOD
    },
    etherscanUrls: {
      factory: `https://sepolia.etherscan.io/address/${factoryAddress}`,
      accessToken: `https://sepolia.etherscan.io/address/${accessTokenAddress}`,
      testToken: `https://sepolia.etherscan.io/address/${testTokenAddress}`
    }
  };

  // Save deployment info to file
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentPath = path.join(deploymentsDir, 'deployment-info.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("========================");

  console.log("\n📋 Contract Addresses:");
  console.log("   🏭 EscrowFactory:", factoryAddress);
  console.log("   🪙 Access Token:", accessTokenAddress);
  console.log("   🪙 Test Token:", testTokenAddress);
  console.log("   🔧 Dst Implementation:", dstImplementationAddress);

  console.log("\n🔗 Etherscan Links:");
  console.log("   🏭 Factory:", deploymentInfo.etherscanUrls.factory);
  console.log("   🪙 Access:", deploymentInfo.etherscanUrls.accessToken);
  console.log("   🪙 Test:", deploymentInfo.etherscanUrls.testToken);

  console.log("\n📝 Next Steps:");
  console.log("   1. Verify contracts on Etherscan");
  console.log("   2. Fund the deployer address with test tokens");
  console.log("   3. Test atomic swap functionality");
  console.log("   4. Set up resolver infrastructure");
  console.log("   ⚡ Fast testing:", WITHDRAWAL_PERIOD / 60, "minute withdrawal period configured");

  console.log("\n💾 Deployment info saved to:", deploymentPath);
  console.log("📄 Other scripts will automatically read from this file");

  console.log("\n✅ Deployment successful!");

  return deploymentInfo;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((deploymentInfo) => {
    console.log("\n🎊 All contracts deployed and configured!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }); 