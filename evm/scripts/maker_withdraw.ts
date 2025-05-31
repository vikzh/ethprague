import { ethers } from "hardhat";
import fs from 'fs';
import path from 'path';

/**
 * 🎯 MAKER WITHDRAWAL SCRIPT
 * 
 * In the correct atomic swap flow:
 * 1. ✅ MAKER created source escrow (TON) with TON tokens + secret hash (MAKER INITIATED)
 * 2. ✅ TAKER created destination escrow (EVM) with ERC20 tokens in response
 * 3. 🎯 MAKER WITHDRAWS ERC20 tokens from destination escrow (THIS SCRIPT)
 * 4. 🔜 TAKER uses revealed secret to claim TON from source escrow
 * 
 * The maker completes their side of the swap by withdrawing the ERC20 tokens
 * they wanted, which reveals the secret for the taker to claim TON.
 */

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
  console.log("🎯 MAKER WITHDRAWAL: Withdrawing ERC20 tokens using secret...");
  console.log("=============================================================");
  
  // Load escrow info
  console.log("\n📖 Step 1: Loading escrow information...");
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const escrowPath = path.join(deploymentsDir, 'escrow-info.json');
  
  if (!fs.existsSync(escrowPath)) {
    throw new Error("❌ No escrow info found! Run interact.ts first to create an escrow.");
  }
  
  const escrowInfo: EscrowInfo = JSON.parse(fs.readFileSync(escrowPath, 'utf8'));
  console.log("   📍 Escrow address:", escrowInfo.escrowAddress);
  console.log("   🪙 Token:", escrowInfo.token.symbol);
  console.log("   💰 Amount:", ethers.formatEther(escrowInfo.amounts.swapAmount), escrowInfo.token.symbol);

  // Get signers - determine maker dynamically
  console.log("\n👥 Step 2: Setting up maker account...");
  const signers = await ethers.getSigners();
  
  // Dynamic maker selection using environment variables
  let maker: any;
  let selectionMethod: string;
  
  if (process.env.MAKER_ADDRESS) {
    // Find signer by address
    const targetAddress = process.env.MAKER_ADDRESS;
    maker = signers.find(signer => signer.address.toLowerCase() === targetAddress.toLowerCase());
    
    if (!maker) {
      console.log("\n❌ ERROR: Specified MAKER_ADDRESS not found in available signers");
      console.log("Available signers:");
      signers.forEach((signer, i) => {
        console.log(`   [${i}] ${signer.address}`);
      });
      console.log("\n💡 Solutions:");
      console.log("   1. Add the private key to hardhat.config.ts accounts array");
      console.log("   2. Use MAKER_ACCOUNT_INDEX instead: export MAKER_ACCOUNT_INDEX=2");
      console.log("   3. Remove MAKER_ADDRESS to use default account index");
      throw new Error(`Maker address ${targetAddress} not available`);
    }
    
    selectionMethod = `address: ${targetAddress}`;
  } else {
    // Use account index (default or from env)
    const accountIndex = process.env.MAKER_ACCOUNT_INDEX ? parseInt(process.env.MAKER_ACCOUNT_INDEX) : 2;
    
    if (accountIndex >= signers.length) {
      console.log(`\n❌ ERROR: Account index ${accountIndex} not available (have ${signers.length} accounts)`);
      console.log("Available accounts:");
      signers.forEach((signer, i) => {
        console.log(`   [${i}] ${signer.address}`);
      });
      console.log("\n💡 Solutions:");
      console.log("   1. Use a valid account index: export MAKER_ACCOUNT_INDEX=1");
      console.log("   2. Add more accounts to hardhat.config.ts");
      console.log("   3. Use specific address: export MAKER_ADDRESS=0x...");
      throw new Error(`Account index ${accountIndex} out of range`);
    }
    
    maker = signers[accountIndex];
    selectionMethod = `index: ${accountIndex}`;
  }
  
  console.log(`   ✅ Maker selected via ${selectionMethod}`);
  console.log("   📍 Maker address:", maker.address);
  console.log("   🎯 Expected maker:", escrowInfo.participants.maker);
  
  // Verify maker address matches
  if (maker.address.toLowerCase() !== escrowInfo.participants.maker.toLowerCase()) {
    console.log("\n⚠️  WARNING: Selected maker doesn't match escrow maker!");
    console.log("   Selected:", maker.address);
    console.log("   Expected:", escrowInfo.participants.maker);
    console.log("\n💡 This will fail unless you're testing with the correct maker account");
  }

  // Check timing
  console.log("\n⏰ Step 3: Checking withdrawal timing...");
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
    console.log("   ⚠️  WARNING: In cancellation period! Withdrawal may fail if taker cancels");
  } else {
    const timeLeft = cancellationOpens - now;
    console.log(`   ✅ Withdrawal period active (${timeLeft} seconds / ${Math.ceil(timeLeft/60)} minutes remaining)`);
  }

  // Get contracts
  console.log("\n🔗 Step 4: Connecting to contracts...");
  const escrow = await ethers.getContractAt("EscrowDst", escrowInfo.escrowAddress);
  const testToken = await ethers.getContractAt("MockERC20", escrowInfo.token.address);
  
  console.log("   ✅ Connected to escrow at:", escrowInfo.escrowAddress);
  console.log("   ✅ Connected to token at:", escrowInfo.token.address);

  // Check balances before
  console.log("\n💰 Step 5: Checking balances before withdrawal...");
  const makerETHBefore = await ethers.provider.getBalance(maker.address);
  const makerTokenBefore = await testToken.balanceOf(maker.address);
  const escrowETHBalance = await ethers.provider.getBalance(escrowInfo.escrowAddress);
  const escrowTokenBalance = await testToken.balanceOf(escrowInfo.escrowAddress);
  
  console.log("   💰 Maker ETH balance:", ethers.formatEther(makerETHBefore), "ETH");
  console.log("   🪙 Maker token balance:", ethers.formatEther(makerTokenBefore), escrowInfo.token.symbol);
  console.log("   🏦 Escrow ETH balance:", ethers.formatEther(escrowETHBalance), "ETH");
  console.log("   🏦 Escrow token balance:", ethers.formatEther(escrowTokenBalance), escrowInfo.token.symbol);

  // Prepare immutables
  console.log("\n🔧 Step 6: Preparing withdrawal transaction...");
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
  console.log("   🔐 Using secret:", escrowInfo.secret);

  // Execute withdrawal
  console.log("\n🚀 Step 7: MAKER withdrawing ERC20 tokens...");
  console.log("   🎯 This reveals the secret for the taker to use on TON blockchain!");
  
  try {
    const tx = await escrow.connect(maker).withdraw(escrowInfo.secret, immutables);
    console.log("   📤 Transaction submitted:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed in block:", receipt?.blockNumber);
    console.log("   ⛽ Gas used:", receipt?.gasUsed?.toString());
    
  } catch (error: any) {
    console.log("\n❌ WITHDRAWAL FAILED!");
    console.log("Error:", error.message);
    
    if (error.message.includes("onlyTaker")) {
      console.log("\n💡 This suggests maker address mismatch. Check:");
      console.log("   - MAKER_ADDRESS environment variable");
      console.log("   - MAKER_ACCOUNT_INDEX environment variable"); 
      console.log("   - Expected maker:", escrowInfo.participants.maker);
    }
    
    throw error;
  }

  // Check balances after
  console.log("\n💰 Step 8: Verifying withdrawal results...");
  const makerETHAfter = await ethers.provider.getBalance(maker.address);
  const makerTokenAfter = await testToken.balanceOf(maker.address);
  const escrowETHAfter = await ethers.provider.getBalance(escrowInfo.escrowAddress);
  const escrowTokenAfter = await testToken.balanceOf(escrowInfo.escrowAddress);
  
  const ethReceived = makerETHAfter - makerETHBefore;
  const tokensReceived = makerTokenAfter - makerTokenBefore;
  
  console.log("   💰 Maker ETH change:", ethers.formatEther(ethReceived), "ETH");
  console.log("   🪙 Maker tokens received:", ethers.formatEther(tokensReceived), escrowInfo.token.symbol);
  console.log("   🏦 Escrow ETH remaining:", ethers.formatEther(escrowETHAfter), "ETH");
  console.log("   🏦 Escrow tokens remaining:", ethers.formatEther(escrowTokenAfter), escrowInfo.token.symbol);

  // Save withdrawal result
  console.log("\n💾 Step 9: Saving withdrawal results...");
  const withdrawalResult = {
    type: "maker_withdrawal",
    timestamp: new Date().toISOString(),
    blockTimestamp: Math.floor(Date.now() / 1000),
    transactionHash: tx.hash,
    maker: {
      address: maker.address,
      selectionMethod: selectionMethod,
      ethChange: ethReceived.toString(),
      tokensReceived: tokensReceived.toString()
    },
    escrow: {
      address: escrowInfo.escrowAddress,
      ethRemaining: escrowETHAfter.toString(),
      tokensRemaining: escrowTokenAfter.toString()
    },
    secretRevealed: escrowInfo.secret,
    metadata: {
      network: escrowInfo.metadata.network,
      chainId: escrowInfo.metadata.chainId,
      economicFlow: escrowInfo.metadata.economicFlow
    }
  };
  
  const withdrawalPath = path.join(deploymentsDir, 'maker-withdrawal-result.json');
  fs.writeFileSync(withdrawalPath, JSON.stringify(withdrawalResult, null, 2));
  console.log("   📄 Results saved to:", withdrawalPath);

  console.log("\n🎉 MAKER WITHDRAWAL SUCCESSFUL!");
  console.log("===============================");
  console.log("✅ Maker received", ethers.formatEther(tokensReceived), escrowInfo.token.symbol, "tokens");
  console.log("✅ Maker received", ethers.formatEther(ethReceived), "ETH safety deposit");
  console.log("🔐 Secret revealed:", escrowInfo.secret);
  console.log("\n🎯 Atomic Swap Progress:");
  console.log("   ✅ MAKER CREATED SOURCE ESCROW (TON) with TON tokens + secret hash (MAKER INITIATED)");
  console.log("   ✅ TAKER CREATED DESTINATION ESCROW (EVM) with ERC20 tokens in response");
  console.log("   🎯 MAKER WITHDREW ERC20 TOKENS (secret revealed)");
  console.log("   🔜 TAKER can now use secret to claim TON on TON blockchain");
  
  console.log("\n🚀 Next Steps:");
  console.log("   1. Taker uses revealed secret to claim TON from source escrow");
  console.log("   2. Atomic swap complete - both parties have their desired tokens!");
  console.log("   💡 ETH safety deposit remains in escrow for potential taker withdrawal");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }); 