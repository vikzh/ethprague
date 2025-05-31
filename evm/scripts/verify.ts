import { run } from "hardhat";

async function main() {
  console.log("🔍 Verifying contracts on Etherscan...");
  
  // These addresses will be output from the deployment script
  // Replace with actual deployed addresses
  const contracts = {
    escrowFactory: "REPLACE_WITH_FACTORY_ADDRESS",
    accessToken: "REPLACE_WITH_ACCESS_TOKEN_ADDRESS", 
    testToken: "REPLACE_WITH_TEST_TOKEN_ADDRESS",
    dstImplementation: "REPLACE_WITH_DST_IMPLEMENTATION_ADDRESS"
  };

  const RESCUE_DELAY = 7 * 24 * 60 * 60; // 7 days
  const CREATION_FEE = "10000000000000000"; // 0.01 ETH in wei
  const DEPLOYER_ADDRESS = "REPLACE_WITH_DEPLOYER_ADDRESS";

  try {
    // Verify Access Token
    console.log("📝 Verifying Access Token...");
    await run("verify:verify", {
      address: contracts.accessToken,
      constructorArguments: ["TON-EVM Access Token", "TEACC"],
    });
    console.log("✅ Access Token verified");

    // Verify Test Token  
    console.log("📝 Verifying Test Token...");
    await run("verify:verify", {
      address: contracts.testToken,
      constructorArguments: ["Test USDC", "TUSDC"],
    });
    console.log("✅ Test Token verified");

    // Verify EscrowFactory
    console.log("📝 Verifying EscrowFactory...");
    await run("verify:verify", {
      address: contracts.escrowFactory,
      constructorArguments: [
        contracts.accessToken,  // accessToken
        DEPLOYER_ADDRESS,       // owner
        RESCUE_DELAY,          // rescueDelayDst
        CREATION_FEE,          // creationFee
        DEPLOYER_ADDRESS       // treasury
      ],
    });
    console.log("✅ EscrowFactory verified");

    // Verify Destination Escrow Implementation
    console.log("📝 Verifying Destination Escrow Implementation...");
    await run("verify:verify", {
      address: contracts.dstImplementation,
      constructorArguments: [
        RESCUE_DELAY,           // rescueDelay
        contracts.accessToken   // accessToken
      ],
    });
    console.log("✅ Destination Escrow Implementation verified");

    console.log("\n🎉 All contracts verified successfully!");

  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 