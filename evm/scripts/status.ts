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
    console.log("   ✅ Escrow created");
    console.log("   📍 Address:", escrowInfo.escrowAddress);
    console.log("   📅 Created:", new Date(escrowInfo.deploymentTime));
    console.log("   💰 Amount:", ethers.formatEther(escrowInfo.amounts.swapAmount), "ETH");
    console.log("   🛡️  Safety Deposit:", ethers.formatEther(escrowInfo.amounts.safetyDeposit), "ETH");
    console.log("   👤 Taker:", escrowInfo.participants.taker);
    console.log("   👤 Maker:", escrowInfo.participants.maker);

    // Check timing
    const currentTime = Math.floor(Date.now() / 1000);
    const withdrawalTime = escrowInfo.timelock.withdrawalOpensAt;
    const publicWithdrawalTime = escrowInfo.timelock.publicWithdrawalOpensAt;
    const cancellationTime = escrowInfo.timelock.cancellationOpensAt;

    console.log("\n   ⏰ Timelock Status:");
    const canWithdrawPrivate = currentTime >= withdrawalTime && currentTime < cancellationTime;
    const canWithdrawPublic = currentTime >= publicWithdrawalTime && currentTime < cancellationTime;
    const canCancel = currentTime >= cancellationTime;

    if (canWithdrawPrivate) {
      console.log("   ✅ Private withdrawal available");
    } else if (currentTime < withdrawalTime) {
      const waitTime = withdrawalTime - currentTime;
      console.log(`   ⏳ Private withdrawal in ${waitTime} seconds (${Math.ceil(waitTime / 60)} minutes)`);
    }

    if (canWithdrawPublic) {
      console.log("   ✅ Public withdrawal available");
    } else if (currentTime < publicWithdrawalTime) {
      const waitTime = publicWithdrawalTime - currentTime;
      console.log(`   ⏳ Public withdrawal in ${waitTime} seconds (${Math.ceil(waitTime / 60)} minutes)`);
    }

    if (canCancel) {
      console.log("   🔴 Cancellation period (escrow can be cancelled)");
    }

  } else {
    console.log("   ❌ No escrow found");
    if (deploymentInfo) {
      console.log("   💡 Run: npx hardhat run scripts/interact.ts --network <network>");
    }
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