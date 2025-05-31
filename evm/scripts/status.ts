import { ethers } from "hardhat";
import * as fs from 'fs';
import * as path from 'path';

function checkFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function loadJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

async function main() {
  console.log("📊 TON-EVM Atomic Swap Status");
  console.log("============================");

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentPath = path.join(deploymentsDir, 'deployment-info.json');
  const escrowPath = path.join(deploymentsDir, 'escrow-info.json');
  const withdrawalPath = path.join(deploymentsDir, 'withdrawal-result.json');

  // Check deployment status
  console.log("\n🏭 Deployment Status:");
  const deploymentInfo = loadJsonFile(deploymentPath);
  if (deploymentInfo) {
    console.log("   ✅ Contracts deployed");
    console.log("   📍 Network:", deploymentInfo.network, `(Chain ID: ${deploymentInfo.chainId})`);
    console.log("   📅 Deployed:", new Date(deploymentInfo.deploymentTime));
    console.log("   🏭 Factory:", deploymentInfo.contracts.escrowFactory);
    console.log("   🪙 Access Token:", deploymentInfo.contracts.accessToken);
    console.log("   🪙 Test Token:", deploymentInfo.contracts.testToken);
  } else {
    console.log("   ❌ No deployment found");
    console.log("   💡 Run: npx hardhat run scripts/deploy.ts --network <network>");
    return;
  }

  // Check escrow status
  console.log("\n📋 Escrow Status:");
  const escrowInfo = loadJsonFile(escrowPath);
  if (escrowInfo) {
    console.log("   ✅ Escrow deployed");
    console.log("   📍 Address:", escrowInfo.escrowAddress);
    console.log("   📅 Created:", new Date(escrowInfo.deploymentTime).toLocaleString());
    
    // Show swap type and details
    const isERC20Swap = escrowInfo.metadata?.swapType === "ERC20";
    if (isERC20Swap && escrowInfo.token) {
      console.log("   🪙 Swap Type: TON → ERC20");
      console.log("   💱 Token:", escrowInfo.token.symbol, `(${escrowInfo.token.address})`);
      console.log("   💰 Amount:", ethers.formatEther(escrowInfo.amounts.swapAmount), escrowInfo.token.symbol);
    } else {
      console.log("   🪙 Swap Type: TON → ETH");
      console.log("   💰 Amount:", ethers.formatEther(escrowInfo.amounts.swapAmount), "ETH");
    }
    
    console.log("   🛡️ Safety Deposit:", ethers.formatEther(escrowInfo.amounts.safetyDeposit), "ETH");
    console.log("   💳 Creation Fee:", ethers.formatEther(escrowInfo.amounts.creationFee), "ETH");
    
    // Calculate timelock status
    const now = Math.floor(Date.now() / 1000);
    const timelock = escrowInfo.timelock;
    
    console.log("\n⏰ Timelock Status:");
    
    const withdrawalStatus = now >= timelock.withdrawalOpensAt ? "✅ Open" : "⏳ Waiting";
    const withdrawalTime = new Date(timelock.withdrawalOpensAt * 1000).toLocaleString();
    console.log(`   - Private Withdrawal: ${withdrawalStatus} (${withdrawalTime})`);
    
    const publicStatus = now >= timelock.publicWithdrawalOpensAt ? "✅ Open" : "⏳ Waiting";
    const publicTime = new Date(timelock.publicWithdrawalOpensAt * 1000).toLocaleString();
    console.log(`   - Public Withdrawal: ${publicStatus} (${publicTime})`);
    
    const cancelStatus = now >= timelock.cancellationOpensAt ? "✅ Open" : "⏳ Waiting";
    const cancelTime = new Date(timelock.cancellationOpensAt * 1000).toLocaleString();
    console.log(`   - Cancellation: ${cancelStatus} (${cancelTime})`);
    
    // Show participants
    console.log("\n👥 Participants:");
    console.log("   - Deployer:", escrowInfo.participants.deployer);
    console.log("   - Taker:", escrowInfo.participants.taker);
    console.log("   - Maker:", escrowInfo.participants.maker);
  } else {
    console.log("   ❌ No escrow found");
    console.log("   💡 Run: npx hardhat run scripts/interact.ts --network <network>");
  }

  // Check withdrawal status
  console.log("\n💸 Withdrawal Status:");
  const withdrawalResult = loadJsonFile(withdrawalPath);
  if (withdrawalResult) {
    console.log("   ✅ Withdrawal completed");
    console.log("   📅 Completed:", new Date(withdrawalResult.withdrawalTime));
    console.log("   🔧 Method:", withdrawalResult.withdrawalMethod);
    console.log("   👤 Withdrawer:", withdrawalResult.withdrawer);
    console.log("   🔑 Secret revealed:", withdrawalResult.secretRevealed);
    console.log("   📍 Transaction:", withdrawalResult.transactionHash);
    console.log("   ⛽ Gas used:", withdrawalResult.gasUsed);
    
    console.log("\n   💰 Balance Changes:");
    console.log("   📈 Maker gain:", ethers.formatEther(withdrawalResult.balanceChanges.makerGain), "ETH");
    console.log("   📈 Withdrawer gain:", ethers.formatEther(withdrawalResult.balanceChanges.signerGain), "ETH");
    console.log("   ⛽ Gas cost:", ethers.formatEther(withdrawalResult.balanceChanges.gasCost), "ETH");
  } else {
    console.log("   ❌ No withdrawal completed");
    if (escrowInfo) {
      console.log("   💡 Run: npx hardhat run scripts/interact_maker.ts --network <network>");
    }
  }

  // Suggest next steps
  console.log("\n🎯 Next Steps:");
  if (!deploymentInfo) {
    console.log("   1. 🏭 Deploy contracts: npx hardhat run scripts/deploy.ts --network <network>");
  } else if (!escrowInfo) {
    console.log("   1. 📋 Create escrow: npx hardhat run scripts/interact.ts --network <network>");
  } else if (!withdrawalResult) {
    const currentTime = Math.floor(Date.now() / 1000);
    const withdrawalTime = escrowInfo.timelock.withdrawalOpensAt;
    
    if (currentTime >= withdrawalTime) {
      console.log("   1. 💸 Complete withdrawal: npx hardhat run scripts/interact_maker.ts --network <network>");
    } else {
      const waitTime = withdrawalTime - currentTime;
      console.log(`   1. ⏳ Wait ${Math.ceil(waitTime / 60)} more minutes, then run withdrawal script`);
    }
  } else {
    console.log("   🎉 Atomic swap completed successfully!");
    console.log("   🔄 You can run deploy.ts again to start a new swap cycle");
  }

  // File status
  console.log("\n📁 Configuration Files:");
  console.log("   📄 deployment-info.json:", checkFileExists(deploymentPath) ? "✅ exists" : "❌ missing");
  console.log("   📄 escrow-info.json:", checkFileExists(escrowPath) ? "✅ exists" : "❌ missing");
  console.log("   📄 withdrawal-result.json:", checkFileExists(withdrawalPath) ? "✅ exists" : "❌ missing");

  console.log("\n💡 All files are automatically created and updated by the scripts.");
  console.log("💡 You can delete files to reset specific stages of the process.");
}

main()
  .then(() => {
    console.log("\n✅ Status check completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Status check failed:");
    console.error(error);
    process.exit(1);
  }); 