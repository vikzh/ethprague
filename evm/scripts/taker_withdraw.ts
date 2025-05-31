/**
 * 🏦 TAKER SAFETY DEPOSIT WITHDRAWAL SCRIPT
 * 
 * In the correct atomic swap flow:
 * 1. ✅ MAKER created source escrow (TON) with TON tokens + secret hash (MAKER INITIATED)
 * 2. ✅ TAKER created destination escrow (EVM) with ERC20 tokens in response
 * 3. ✅ MAKER withdrew ERC20 tokens from destination escrow (secret revealed)
 * 4. ✅ TAKER used revealed secret to claim TON from source escrow
 * 5. 🎯 TAKER WITHDRAWS ETH SAFETY DEPOSIT (THIS SCRIPT - OPTIONAL CLEANUP)
 * 
 * This is the final cleanup step where the taker recovers their ETH safety deposit
 * after the atomic swap is successfully completed.
 */

import { ethers } from "hardhat";
import fs from 'fs';
import path from 'path';

interface EscrowInfo {
  escrowAddress: string;
  secret: string;
  participants: {
    deployer: string;
    taker: string;
    maker: string;
  };
  immutables: {
    orderHash: string;
    hashlock: string;
    maker: string;
    taker: string;
    token: string;
    amount: string;
    safetyDeposit: string;
    timelocks: string;
  };
  timelock: {
    withdrawalOpensAt: number;
    publicWithdrawalOpensAt: number;
    cancellationOpensAt: number;
  };
  token: {
    address: string;
    symbol: string;
    name: string;
  };
  amounts: {
    swapAmount: string;
    safetyDeposit: string;
    creationFee: string;
  };
  metadata: {
    network: string;
    chainId: number;
    economicFlow?: {
      takerProvides: string;
      takerReceives: string;
      makerProvides: string;
      makerReceives: string;
    };
  };
}

async function main() {
  console.log("🏦 TAKER SAFETY DEPOSIT WITHDRAWAL");
  console.log("==================================");
  console.log("💡 This script is for after the atomic swap is complete");
  console.log("💡 Taker withdraws remaining ETH safety deposit");
  
  // Load escrow info
  console.log("\n📖 Step 1: Loading escrow information...");
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const escrowPath = path.join(deploymentsDir, 'escrow-info.json');
  
  if (!fs.existsSync(escrowPath)) {
    throw new Error("❌ No escrow info found! Run interact.ts first to create an escrow.");
  }
  
  const escrowInfo: EscrowInfo = JSON.parse(fs.readFileSync(escrowPath, 'utf8'));
  console.log("   📍 Escrow address:", escrowInfo.escrowAddress);
  console.log("   💰 Safety deposit:", ethers.formatEther(escrowInfo.amounts.safetyDeposit), "ETH");

  // Check if maker has already withdrawn
  console.log("\n🔍 Step 2: Checking atomic swap status...");
  const makerWithdrawalPath = path.join(deploymentsDir, 'maker-withdrawal-result.json');
  
  if (!fs.existsSync(makerWithdrawalPath)) {
    console.log("   ⚠️  WARNING: No maker withdrawal detected yet");
    console.log("   💡 Maker should withdraw ERC20 tokens first");
    console.log("   💡 This reveals the secret for the atomic swap");
    console.log("\n   🤔 Do you want to proceed anyway? This might be a test scenario");
  } else {
    const makerResult = JSON.parse(fs.readFileSync(makerWithdrawalPath, 'utf8'));
    console.log("   ✅ Maker withdrawal completed at:", makerResult.timestamp);
    console.log("   🔐 Secret was revealed:", makerResult.secretRevealed);
    console.log("   🪙 Maker received:", ethers.formatEther(makerResult.maker.tokensReceived), escrowInfo.token.symbol);
  }

  // Get signers - determine taker dynamically
  console.log("\n👥 Step 3: Setting up taker account...");
  const signers = await ethers.getSigners();
  
  // Dynamic taker selection using environment variables
  let taker: any;
  let selectionMethod: string;
  
  if (process.env.TAKER_ADDRESS) {
    // Find signer by address
    const targetAddress = process.env.TAKER_ADDRESS;
    taker = signers.find(signer => signer.address.toLowerCase() === targetAddress.toLowerCase());
    
    if (!taker) {
      console.log("\n❌ ERROR: Specified TAKER_ADDRESS not found in available signers");
      console.log("Available signers:");
      signers.forEach((signer, i) => {
        console.log(`   [${i}] ${signer.address}`);
      });
      console.log("\n💡 Solutions:");
      console.log("   1. Add the private key to hardhat.config.ts accounts array");
      console.log("   2. Use TAKER_ACCOUNT_INDEX instead: export TAKER_ACCOUNT_INDEX=1");
      console.log("   3. Remove TAKER_ADDRESS to use default account index");
      throw new Error(`Taker address ${targetAddress} not available`);
    }
    
    selectionMethod = `address: ${targetAddress}`;
  } else {
    // Use account index (default or from env)
    const accountIndex = process.env.TAKER_ACCOUNT_INDEX ? parseInt(process.env.TAKER_ACCOUNT_INDEX) : 1;
    
    if (accountIndex >= signers.length) {
      console.log(`\n❌ ERROR: Account index ${accountIndex} not available (have ${signers.length} accounts)`);
      console.log("Available accounts:");
      signers.forEach((signer, i) => {
        console.log(`   [${i}] ${signer.address}`);
      });
      console.log("\n💡 Solutions:");
      console.log("   1. Use a valid account index: export TAKER_ACCOUNT_INDEX=1");
      console.log("   2. Add more accounts to hardhat.config.ts");
      console.log("   3. Use specific address: export TAKER_ADDRESS=0x...");
      throw new Error(`Account index ${accountIndex} out of range`);
    }
    
    taker = signers[accountIndex];
    selectionMethod = `index: ${accountIndex}`;
  }
  
  console.log(`   ✅ Taker selected via ${selectionMethod}`);
  console.log("   📍 Taker address:", taker.address);
  console.log("   🎯 Expected taker:", escrowInfo.participants.taker);
  
  // Verify taker address matches
  if (taker.address.toLowerCase() !== escrowInfo.participants.taker.toLowerCase()) {
    console.log("\n⚠️  WARNING: Selected taker doesn't match escrow taker!");
    console.log("   Selected:", taker.address);
    console.log("   Expected:", escrowInfo.participants.taker);
    console.log("\n💡 This will fail unless you're testing with the correct taker account");
  }

  // Check timing - we have more flexibility for safety deposit withdrawal
  console.log("\n⏰ Step 4: Checking withdrawal timing...");
  const now = Math.floor(Date.now() / 1000);
  const withdrawalOpens = escrowInfo.timelock.withdrawalOpensAt;
  const cancellationOpens = escrowInfo.timelock.cancellationOpensAt;
  
  console.log("   🕐 Current time:", new Date(now * 1000).toISOString());
  console.log("   🟢 Withdrawal opens:", new Date(withdrawalOpens * 1000).toISOString());
  console.log("   🔴 Cancellation opens:", new Date(cancellationOpens * 1000).toISOString());
  
  if (now < withdrawalOpens) {
    const waitTime = withdrawalOpens - now;
    console.log(`   ⏳ Must wait ${waitTime} seconds (${Math.ceil(waitTime/60)} minutes) for withdrawal period`);
    throw new Error("Withdrawal period not yet open");
  }
  
  if (now >= cancellationOpens) {
    console.log("   ⚠️  In cancellation period - can use cancel() instead of withdraw()");
  } else {
    const timeLeft = cancellationOpens - now;
    console.log(`   ✅ Withdrawal period active (${timeLeft} seconds / ${Math.ceil(timeLeft/60)} minutes remaining)`);
  }

  // Get contracts
  console.log("\n🔗 Step 5: Connecting to contracts...");
  const escrow = await ethers.getContractAt("EscrowDst", escrowInfo.escrowAddress);
  const testToken = await ethers.getContractAt("MockERC20", escrowInfo.token.address);
  
  console.log("   ✅ Connected to escrow at:", escrowInfo.escrowAddress);
  console.log("   ✅ Connected to token at:", escrowInfo.token.address);

  // Check current state
  console.log("\n💰 Step 6: Checking current balances...");
  const takerETHBefore = await ethers.provider.getBalance(taker.address);
  const takerTokenBefore = await testToken.balanceOf(taker.address);
  const escrowETHBalance = await ethers.provider.getBalance(escrowInfo.escrowAddress);
  const escrowTokenBalance = await testToken.balanceOf(escrowInfo.escrowAddress);
  
  console.log("   💰 Taker ETH balance:", ethers.formatEther(takerETHBefore), "ETH");
  console.log("   🪙 Taker token balance:", ethers.formatEther(takerTokenBefore), escrowInfo.token.symbol);
  console.log("   🏦 Escrow ETH balance:", ethers.formatEther(escrowETHBalance), "ETH");
  console.log("   🏦 Escrow token balance:", ethers.formatEther(escrowTokenBalance), escrowInfo.token.symbol);

  // Determine withdrawal method
  let useCancel = false;
  if (now >= cancellationOpens && escrowTokenBalance > 0) {
    console.log("\n🤔 Step 7: Choosing withdrawal method...");
    console.log("   💡 Tokens still in escrow - using cancel() to get everything back");
    useCancel = true;
  } else if (escrowTokenBalance == 0n) {
    console.log("\n🤔 Step 7: Choosing withdrawal method...");
    console.log("   ✅ Tokens already withdrawn by maker - using withdraw() for safety deposit");
    useCancel = false;
  } else {
    console.log("\n🤔 Step 7: Choosing withdrawal method...");
    console.log("   💡 Using standard withdraw() method");
    useCancel = false;
  }

  // Prepare immutables
  console.log("\n🔧 Step 8: Preparing transaction...");
  const immutables = {
    orderHash: escrowInfo.immutables.orderHash,
    hashlock: escrowInfo.immutables.hashlock,
    maker: BigInt(escrowInfo.immutables.maker),
    taker: BigInt(escrowInfo.immutables.taker),
    token: BigInt(escrowInfo.immutables.token),
    amount: BigInt(escrowInfo.immutables.amount),
    safetyDeposit: BigInt(escrowInfo.immutables.safetyDeposit),
    timelocks: BigInt(escrowInfo.immutables.timelocks)
  };
  
  console.log("   ✅ Immutables prepared");

  // Execute withdrawal
  console.log("\n🚀 Step 9: Executing taker withdrawal...");
  let tx: any;
  
  try {
    if (useCancel) {
      console.log("   🔄 Using cancel() method to retrieve tokens + safety deposit");
      tx = await escrow.connect(taker).cancel(immutables);
    } else {
      console.log("   💰 Using withdraw() method for safety deposit");
      tx = await escrow.connect(taker).withdraw(escrowInfo.secret, immutables);
    }
    
    console.log("   📤 Transaction submitted:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed in block:", receipt?.blockNumber);
    console.log("   ⛽ Gas used:", receipt?.gasUsed?.toString());
    
  } catch (error: any) {
    console.log("\n❌ WITHDRAWAL FAILED!");
    console.log("Error:", error.message);
    
    if (error.message.includes("onlyTaker")) {
      console.log("\n💡 This suggests taker address mismatch. Check:");
      console.log("   - TAKER_ADDRESS environment variable");
      console.log("   - TAKER_ACCOUNT_INDEX environment variable"); 
      console.log("   - Expected taker:", escrowInfo.participants.taker);
    }
    
    throw error;
  }

  // Check balances after
  console.log("\n💰 Step 10: Verifying withdrawal results...");
  const takerETHAfter = await ethers.provider.getBalance(taker.address);
  const takerTokenAfter = await testToken.balanceOf(taker.address);
  const escrowETHAfter = await ethers.provider.getBalance(escrowInfo.escrowAddress);
  const escrowTokenAfter = await testToken.balanceOf(escrowInfo.escrowAddress);
  
  const ethReceived = takerETHAfter - takerETHBefore;
  const tokensReceived = takerTokenAfter - takerTokenBefore;
  
  console.log("   💰 Taker ETH change:", ethers.formatEther(ethReceived), "ETH");
  console.log("   🪙 Taker tokens change:", ethers.formatEther(tokensReceived), escrowInfo.token.symbol);
  console.log("   🏦 Escrow ETH remaining:", ethers.formatEther(escrowETHAfter), "ETH");
  console.log("   🏦 Escrow tokens remaining:", ethers.formatEther(escrowTokenAfter), escrowInfo.token.symbol);

  // Save withdrawal result
  console.log("\n💾 Step 11: Saving withdrawal results...");
  const withdrawalResult = {
    type: "taker_safety_deposit_withdrawal",
    method: useCancel ? "cancel" : "withdraw",
    timestamp: new Date().toISOString(),
    blockTimestamp: Math.floor(Date.now() / 1000),
    transactionHash: tx.hash,
    taker: {
      address: taker.address,
      selectionMethod: selectionMethod,
      ethReceived: ethReceived.toString(),
      tokensReceived: tokensReceived.toString()
    },
    escrow: {
      address: escrowInfo.escrowAddress,
      ethRemaining: escrowETHAfter.toString(),
      tokensRemaining: escrowTokenAfter.toString()
    },
    metadata: {
      network: escrowInfo.metadata.network,
      chainId: escrowInfo.metadata.chainId,
      economicFlow: escrowInfo.metadata.economicFlow
    }
  };
  
  const withdrawalPath = path.join(deploymentsDir, 'taker-withdrawal-result.json');
  fs.writeFileSync(withdrawalPath, JSON.stringify(withdrawalResult, null, 2));
  console.log("   📄 Results saved to:", withdrawalPath);

  console.log("\n🎉 TAKER SAFETY DEPOSIT WITHDRAWAL SUCCESSFUL!");
  console.log("============================================");
  console.log("✅ Taker received", ethers.formatEther(ethReceived), "ETH");
  
  if (tokensReceived > 0n) {
    console.log("✅ Taker also received", ethers.formatEther(tokensReceived), escrowInfo.token.symbol);
    console.log("💡 This suggests cancellation rather than normal atomic swap completion");
  }
  
  console.log("\n🎯 Atomic Swap Status:");
  if (useCancel) {
    console.log("   🔄 CANCELLATION: Taker recovered their tokens and safety deposit");
    console.log("   💡 This means the atomic swap was cancelled, not completed");
  } else {
    console.log("   ✅ COMPLETION: Taker recovered their safety deposit");
    console.log("   💡 Atomic swap was successfully completed!");
    console.log("   🔄 Both parties should now have their desired tokens");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }); 