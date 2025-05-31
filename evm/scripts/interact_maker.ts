import { ethers } from "hardhat";
import { EscrowDst, MockERC20 } from "../typechain-types";
import * as fs from 'fs';
import * as path from 'path';

// Load escrow info
function loadEscrowInfo() {
  const escrowPath = path.join(__dirname, '..', 'deployments', 'escrow-info.json');
  
  if (!fs.existsSync(escrowPath)) {
    throw new Error(`❌ Escrow info not found at ${escrowPath}. Please run interact.ts script first to create an escrow.`);
  }
  
  const escrowData = fs.readFileSync(escrowPath, 'utf8');
  return JSON.parse(escrowData);
}

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
  console.log("💸 TON-EVM Atomic Swap: Withdrawing from Escrow");
  console.log("===============================================");

  // Load configuration from files
  const escrowInfo = loadEscrowInfo();
  const deploymentInfo = loadDeploymentInfo();
  
  console.log("📄 Loaded escrow info from:", new Date(escrowInfo.deploymentTime));
  console.log("🌐 Network:", escrowInfo.metadata.network, `(Chain ID: ${escrowInfo.metadata.chainId})`);

  // Extract configuration from loaded data
  const ESCROW_ADDRESS = escrowInfo.escrowAddress;
  const ACCESS_TOKEN_ADDRESS = deploymentInfo.contracts.accessToken;
  const SECRET = escrowInfo.secret;
  
  // Convert immutables from strings back to proper types
  const IMMUTABLES = {
    orderHash: escrowInfo.immutables.orderHash,
    hashlock: escrowInfo.immutables.hashlock,
    maker: escrowInfo.immutables.maker,
    taker: escrowInfo.immutables.taker,
    token: escrowInfo.immutables.token,
    amount: escrowInfo.immutables.amount,
    safetyDeposit: escrowInfo.immutables.safetyDeposit,
    timelocks: escrowInfo.immutables.timelocks
  };

  console.log("\n📋 Escrow Details:");
  console.log("   - Address:", ESCROW_ADDRESS);
  console.log("   - Swap Amount:", ethers.formatEther(IMMUTABLES.amount), "ETH");
  console.log("   - Safety Deposit:", ethers.formatEther(IMMUTABLES.safetyDeposit), "ETH");
  console.log("   - Taker:", `0x${BigInt(IMMUTABLES.taker).toString(16).padStart(40, '0')}`);
  console.log("   - Maker:", `0x${BigInt(IMMUTABLES.maker).toString(16).padStart(40, '0')}`);

  const [signer] = await ethers.getSigners();
  console.log("\n👤 Withdrawing with account:", signer.address);

  // Connect to contracts
  const escrow = await ethers.getContractAt("EscrowDst", ESCROW_ADDRESS) as EscrowDst;
  const accessToken = await ethers.getContractAt("MockERC20", ACCESS_TOKEN_ADDRESS) as MockERC20;

  console.log("\n🔗 Connected to contracts:");
  console.log("   - Escrow:", await escrow.getAddress());
  console.log("   - Access Token:", await accessToken.getAddress());

  try {
    // Check initial balances
    console.log("\n💰 Step 1: Checking initial balances...");
    const signerBalance = await ethers.provider.getBalance(signer.address);
    const escrowBalance = await ethers.provider.getBalance(ESCROW_ADDRESS);
    
    console.log("   - Signer balance:", ethers.formatEther(signerBalance), "ETH");
    console.log("   - Escrow balance:", ethers.formatEther(escrowBalance), "ETH");

    // Check if we have access tokens for public withdrawal
    const accessBalance = await accessToken.balanceOf(signer.address);
    const hasAccessTokens = accessBalance > 0;
    
    console.log("   - Access token balance:", ethers.formatEther(accessBalance));
    console.log("   - Can use public withdrawal:", hasAccessTokens ? "✅ Yes" : "❌ No");

    // Determine withdrawal method
    const takerAddress = `0x${BigInt(IMMUTABLES.taker).toString(16).padStart(40, '0')}`;
    const isTaker = signer.address.toLowerCase() === takerAddress.toLowerCase();
    
    console.log("\n🔍 Step 2: Determining withdrawal method...");
    console.log("   - Signer address:", signer.address);
    console.log("   - Taker address:", takerAddress);
    console.log("   - Is taker:", isTaker ? "✅ Yes" : "❌ No");

    let withdrawalMethod: "private" | "public" | "none";
    
    if (isTaker) {
      withdrawalMethod = "private";
      console.log("   📋 Using private withdrawal (taker privilege)");
    } else if (hasAccessTokens) {
      withdrawalMethod = "public";
      console.log("   📋 Using public withdrawal (access token holder)");
    } else {
      withdrawalMethod = "none";
      console.log("   ❌ Cannot withdraw: not taker and no access tokens");
      return;
    }

    // Check timing constraints using saved timelock info
    console.log("\n⏰ Step 3: Checking timing constraints...");
    const currentTime = Math.floor(Date.now() / 1000);
    
    const withdrawalTime = escrowInfo.timelock.withdrawalOpensAt;
    const publicWithdrawalTime = escrowInfo.timelock.publicWithdrawalOpensAt;
    const cancellationTime = escrowInfo.timelock.cancellationOpensAt;
    
    console.log("   - Deployed at:", new Date(escrowInfo.deploymentTimestamp * 1000).toISOString());
    console.log("   - Current time:", new Date(currentTime * 1000).toISOString());
    console.log("   - Private withdrawal opens:", new Date(withdrawalTime * 1000).toISOString());
    console.log("   - Public withdrawal opens:", new Date(publicWithdrawalTime * 1000).toISOString());
    console.log("   - Cancellation opens:", new Date(cancellationTime * 1000).toISOString());

    // Check if withdrawal is possible
    const canWithdrawPrivate = currentTime >= withdrawalTime && currentTime < cancellationTime;
    const canWithdrawPublic = currentTime >= publicWithdrawalTime && currentTime < cancellationTime;
    
    console.log("   - Can withdraw privately:", canWithdrawPrivate ? "✅ Yes" : "❌ No");
    console.log("   - Can withdraw publicly:", canWithdrawPublic ? "✅ Yes" : "❌ No");

    if (withdrawalMethod === "private" && !canWithdrawPrivate) {
      const waitTime = withdrawalTime - currentTime;
      if (waitTime > 0) {
        console.log(`   ⏳ Need to wait ${waitTime} seconds for private withdrawal`);
        return;
      } else {
        console.log("   ❌ Private withdrawal period has expired");
        return;
      }
    }

    if (withdrawalMethod === "public" && !canWithdrawPublic) {
      const waitTime = publicWithdrawalTime - currentTime;
      if (waitTime > 0) {
        console.log(`   ⏳ Need to wait ${waitTime} seconds for public withdrawal`);
        return;
      } else {
        console.log("   ❌ Public withdrawal period has expired");
        return;
      }
    }

    // Perform withdrawal
    console.log("\n💸 Step 4: Performing withdrawal...");
    console.log("   - Method:", withdrawalMethod);
    console.log("   - Secret:", SECRET);
    
    const makerAddress = `0x${BigInt(IMMUTABLES.maker).toString(16).padStart(40, '0')}`;
    console.log("   - Maker (will receive funds):", makerAddress);
    console.log("   - Signer (will receive safety deposit):", signer.address);

    // Get balances before withdrawal
    const makerBalanceBefore = await ethers.provider.getBalance(makerAddress);
    const signerBalanceBefore = await ethers.provider.getBalance(signer.address);
    
    console.log("\n📊 Balances before withdrawal:");
    console.log("   - Maker:", ethers.formatEther(makerBalanceBefore), "ETH");
    console.log("   - Signer:", ethers.formatEther(signerBalanceBefore), "ETH");

    // Execute withdrawal
    let tx;
    if (withdrawalMethod === "private") {
      console.log("🔐 Executing private withdrawal...");
      tx = await escrow.withdraw(SECRET, IMMUTABLES);
    } else {
      console.log("🔓 Executing public withdrawal...");
      tx = await escrow.publicWithdraw(SECRET, IMMUTABLES);
    }

    const receipt = await tx.wait();
    console.log("   ✅ Withdrawal transaction:", receipt?.hash);
    console.log("   ⛽ Gas used:", receipt?.gasUsed.toString());

    // Check balances after withdrawal
    console.log("\n📊 Balances after withdrawal:");
    const makerBalanceAfter = await ethers.provider.getBalance(makerAddress);
    const signerBalanceAfter = await ethers.provider.getBalance(signer.address);
    const escrowBalanceAfter = await ethers.provider.getBalance(ESCROW_ADDRESS);
    
    console.log("   - Maker:", ethers.formatEther(makerBalanceAfter), "ETH");
    console.log("   - Signer:", ethers.formatEther(signerBalanceAfter), "ETH");
    console.log("   - Escrow:", ethers.formatEther(escrowBalanceAfter), "ETH");

    // Calculate changes
    const makerGain = makerBalanceAfter - makerBalanceBefore;
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const signerChange = signerBalanceAfter - signerBalanceBefore + gasUsed; // Add back gas cost
    
    console.log("\n📈 Balance changes:");
    console.log("   - Maker gained:", ethers.formatEther(makerGain), "ETH");
    console.log("   - Signer gained (before gas):", ethers.formatEther(signerChange), "ETH");
    console.log("   - Gas cost:", ethers.formatEther(gasUsed), "ETH");

    // Verify withdrawal event
    const events = await escrow.queryFilter(escrow.filters.EscrowWithdrawal());
    const withdrawalEvent = events[events.length - 1];
    
    if (withdrawalEvent) {
      console.log("\n🎉 Withdrawal event detected:");
      console.log("   - Secret revealed:", withdrawalEvent.args.secret);
      console.log("   - Block number:", withdrawalEvent.blockNumber);
    }

    // Save withdrawal result
    const withdrawalResult = {
      transactionHash: receipt?.hash,
      blockNumber: receipt?.blockNumber,
      withdrawalTime: new Date().toISOString(),
      withdrawalTimestamp: Math.floor(Date.now() / 1000),
      withdrawalMethod: withdrawalMethod,
      withdrawer: signer.address,
      secretRevealed: SECRET,
      gasUsed: receipt?.gasUsed.toString(),
      balanceChanges: {
        makerGain: makerGain.toString(),
        signerGain: signerChange.toString(),
        gasCost: gasUsed.toString()
      },
      escrowAddress: ESCROW_ADDRESS,
      originalEscrowInfo: escrowInfo
    };

    // Save withdrawal result to file
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const withdrawalPath = path.join(deploymentsDir, 'withdrawal-result.json');
    fs.writeFileSync(withdrawalPath, JSON.stringify(withdrawalResult, null, 2));

    console.log("\n🎉 ATOMIC SWAP COMPLETED!");
    console.log("=========================");
    console.log("✅ Funds successfully withdrawn from escrow");
    console.log("✅ Maker received swap amount");
    console.log("✅ Withdrawer received safety deposit");
    console.log("✅ Secret revealed on blockchain");
    
    console.log("\n🔄 Cross-chain completion:");
    console.log("   1. ✅ EVM escrow withdrawal completed");
    console.log("   2. 🔍 Secret now visible on EVM blockchain");
    console.log("   3. 🎯 TON side can now use this secret for their withdrawal");
    console.log("   4. 🎊 Atomic swap fully completed!");

    console.log("\n💾 Withdrawal result saved to:", withdrawalPath);

    return withdrawalResult;

  } catch (error) {
    console.error("\n❌ Withdrawal failed:");
    console.error(error);
    
    // Provide helpful error context
    if (error instanceof Error) {
      if (error.message.includes("InvalidTime")) {
        console.log("\n💡 Possible reasons:");
        console.log("   - Withdrawal period not yet started");
        console.log("   - Withdrawal period has expired");
        console.log("   - Check the timing constraints above");
      } else if (error.message.includes("InvalidSecret")) {
        console.log("\n💡 Possible reasons:");
        console.log("   - Incorrect secret provided");
        console.log("   - Secret doesn't match the hashlock");
      } else if (error.message.includes("InvalidCaller")) {
        console.log("\n💡 Possible reasons:");
        console.log("   - Not authorized to call this function");
        console.log("   - Need access tokens for public withdrawal");
        console.log("   - Only taker can call private withdrawal");
      }
    }
    
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Withdrawal completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Withdrawal failed:");
    console.error(error);
    process.exit(1);
  }); 