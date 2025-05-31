import { ethers } from "hardhat";
import fs from 'fs';
import path from 'path';

async function main() {
  console.log("🔍 CHECKING POST-SWAP BALANCES");
  console.log("==============================");
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'deployment-info.json');
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  // Load escrow info
  const escrowPath = path.join(__dirname, '..', 'deployments', 'escrow-info.json');
  const escrowInfo = JSON.parse(fs.readFileSync(escrowPath, 'utf8'));
  
  // Get signers
  const [deployer, taker, maker] = await ethers.getSigners();
  
  // Connect to token contract
  const testToken = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.testToken);
  
  console.log("👤 Participants:");
  console.log("   - Deployer:", deployer.address);
  console.log("   - Taker:", taker.address);  
  console.log("   - Maker:", maker.address);
  
  console.log("\n💰 Final Balances:");
  
  // Check ETH balances
  const deployerETH = await ethers.provider.getBalance(deployer.address);
  const takerETH = await ethers.provider.getBalance(taker.address);
  const makerETH = await ethers.provider.getBalance(maker.address);
  
  console.log("   ETH Balances:");
  console.log("   - Deployer:", ethers.formatEther(deployerETH), "ETH");
  console.log("   - Taker:", ethers.formatEther(takerETH), "ETH");
  console.log("   - Maker:", ethers.formatEther(makerETH), "ETH");
  
  // Check token balances
  const deployerTokens = await testToken.balanceOf(deployer.address);
  const takerTokens = await testToken.balanceOf(taker.address);
  const makerTokens = await testToken.balanceOf(maker.address);
  
  console.log("\n   Token Balances:");
  console.log("   - Deployer:", ethers.formatEther(deployerTokens), "TEST");
  console.log("   - Taker:", ethers.formatEther(takerTokens), "TEST");
  console.log("   - Maker:", ethers.formatEther(makerTokens), "TEST");
  
  // Check escrow balance
  const escrowETH = await ethers.provider.getBalance(escrowInfo.escrowAddress);
  const escrowTokens = await testToken.balanceOf(escrowInfo.escrowAddress);
  
  console.log("\n   Escrow Balances:");
  console.log("   - Escrow ETH:", ethers.formatEther(escrowETH), "ETH");
  console.log("   - Escrow Tokens:", ethers.formatEther(escrowTokens), "TEST");
  
  console.log("\n🎯 Atomic Swap Result Analysis:");
  
  if (makerTokens > 0n) {
    console.log("   ✅ MAKER received", ethers.formatEther(makerTokens), "TEST tokens");
  } else {
    console.log("   ❌ MAKER did not receive tokens");
  }
  
  if (takerTokens === 0n) {
    console.log("   ✅ TAKER provided tokens successfully");
  } else {
    console.log("   ❌ TAKER still has tokens - swap may have failed");
  }
  
  if (escrowETH === 0n && escrowTokens === 0n) {
    console.log("   ✅ ESCROW fully drained - swap completed");
  } else {
    console.log("   ⚠️  ESCROW still has funds");
  }
  
  console.log("\n🔐 Secret Status:");
  const withdrawalPath = path.join(__dirname, '..', 'deployments', 'taker-withdrawal-result.json');
  if (fs.existsSync(withdrawalPath)) {
    console.log("   ✅ SECRET REVEALED through taker withdrawal");
    console.log("   🎯 Maker can now use secret to claim TON on TON blockchain");
  } else {
    console.log("   ❌ Secret not yet revealed");
  }
  
  console.log("\n🎊 ATOMIC SWAP VERIFICATION COMPLETE!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Balance check failed:", error);
    process.exit(1);
  }); 