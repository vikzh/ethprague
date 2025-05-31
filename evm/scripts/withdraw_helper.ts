import { ethers } from "hardhat";
import { EscrowFactory, EscrowDst } from "../typechain-types";

async function main() {
  console.log("🔧 Withdrawal Helper: Extract Escrow Information");
  console.log("===============================================");

  // Configuration - Replace with your deployed addresses
  const FACTORY_ADDRESS = "REPLACE_WITH_FACTORY_ADDRESS";
  const ACCESS_TOKEN_ADDRESS = "REPLACE_WITH_ACCESS_TOKEN_ADDRESS";
  
  // Optional: specify specific escrow address, or leave empty to use latest
  const SPECIFIC_ESCROW_ADDRESS = ""; // Leave empty for latest escrow

  const [signer] = await ethers.getSigners();
  console.log("👤 Using account:", signer.address);

  try {
    // Connect to factory
    const factory = await ethers.getContractAt("EscrowFactory", FACTORY_ADDRESS) as EscrowFactory;
    console.log("🏭 Connected to factory:", await factory.getAddress());

    // Find escrow address
    let escrowAddress: string;
    
    if (SPECIFIC_ESCROW_ADDRESS) {
      escrowAddress = SPECIFIC_ESCROW_ADDRESS;
      console.log("📍 Using specified escrow:", escrowAddress);
    } else {
      // Get latest escrow from events
      console.log("🔍 Finding latest escrow from factory events...");
      const events = await factory.queryFilter(factory.filters.DstEscrowCreated());
      
      if (events.length === 0) {
        console.log("❌ No escrows found in factory events");
        return;
      }
      
      const latestEvent = events[events.length - 1];
      escrowAddress = latestEvent.args.escrow;
      console.log("📍 Found latest escrow:", escrowAddress);
      console.log("   - Hashlock:", latestEvent.args.hashlock);
      console.log("   - Taker:", latestEvent.args.taker);
    }

    // Connect to escrow
    const escrow = await ethers.getContractAt("EscrowDst", escrowAddress) as EscrowDst;
    
    // Get escrow details
    console.log("\n💰 Escrow Status:");
    const escrowBalance = await ethers.provider.getBalance(escrowAddress);
    console.log("   - Balance:", ethers.formatEther(escrowBalance), "ETH");
    
    // Check if escrow has been withdrawn from
    const withdrawalEvents = await escrow.queryFilter(escrow.filters.EscrowWithdrawal());
    const hasBeenWithdrawn = withdrawalEvents.length > 0;
    
    console.log("   - Status:", hasBeenWithdrawn ? "❌ Already withdrawn" : "✅ Active");
    
    if (hasBeenWithdrawn) {
      const lastWithdrawal = withdrawalEvents[withdrawalEvents.length - 1];
      console.log("   - Last withdrawal secret:", lastWithdrawal.args.secret);
      console.log("   - Block number:", lastWithdrawal.blockNumber);
    }

    // Generate example configuration for interact_maker.ts
    console.log("\n📋 Configuration for interact_maker.ts:");
    console.log("=====================================");
    
    console.log(`
// Replace these values in scripts/interact_maker.ts:

const ESCROW_ADDRESS = "${escrowAddress}";
const ACCESS_TOKEN_ADDRESS = "${ACCESS_TOKEN_ADDRESS}";
const SECRET = "0x..."; // The revealed secret (32 bytes hex)

const IMMUTABLES = {
  orderHash: "0x...",     // Order hash from escrow creation
  hashlock: "0x...",      // Hashlock from escrow creation
  maker: "0x...",         // Maker address as uint256 (BigInt)
  taker: "0x...",         // Taker address as uint256 (BigInt)
  token: "0x...",         // Token address as uint256 (BigInt, 0 for ETH)
  amount: "...",          // Amount in wei (string)
  safetyDeposit: "...",   // Safety deposit in wei (string)
  timelocks: "..."        // Timelocks as uint256 (string)
};`);

    // If we have the creation event, we can extract some values
    if (!SPECIFIC_ESCROW_ADDRESS) {
      const creationEvents = await factory.queryFilter(factory.filters.DstEscrowCreated());
      const creationEvent = creationEvents.find(e => e.args.escrow === escrowAddress);
      
      if (creationEvent) {
        console.log("\n🔍 Values extracted from creation event:");
        console.log(`   hashlock: "${creationEvent.args.hashlock}"`);
        console.log(`   taker: "${creationEvent.args.taker}"`);
      }
    }

    // Example secret generation
    console.log("\n🔑 Example Secret Generation:");
    console.log("=============================");
    const exampleSecret = ethers.keccak256(ethers.toUtf8Bytes("example-secret-123"));
    const exampleHashlock = ethers.keccak256(exampleSecret);
    
    console.log(`Example secret: "${exampleSecret}"`);
    console.log(`Example hashlock: "${exampleHashlock}"`);
    
    console.log("\n⚠️ Important:");
    console.log("   - Use the ACTUAL secret that was used to create the escrow");
    console.log("   - The secret must hash to the hashlock in the escrow");
    console.log("   - Get the secret from the TON blockchain or from escrow creation");

    // Time analysis
    console.log("\n⏰ Timing Information:");
    console.log("=====================");
    const currentTime = Math.floor(Date.now() / 1000);
    console.log("   - Current time:", new Date(currentTime * 1000).toISOString());
    console.log("   - Current timestamp:", currentTime);
    
    console.log("\n🎯 Next Steps:");
    console.log("==============");
    console.log("1. Update scripts/interact_maker.ts with the values above");
    console.log("2. Get the correct secret from your escrow creation process");
    console.log("3. Get the correct immutables from your escrow creation process");
    console.log("4. Run: npx hardhat run scripts/interact_maker.ts --network sepolia");

    // Check if signer has access tokens
    const accessToken = await ethers.getContractAt("MockERC20", ACCESS_TOKEN_ADDRESS);
    const accessBalance = await accessToken.balanceOf(signer.address);
    
    console.log("\n👤 Signer Information:");
    console.log("======================");
    console.log("   - Address:", signer.address);
    console.log("   - ETH balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
    console.log("   - Access tokens:", ethers.formatEther(accessBalance));
    console.log("   - Can public withdraw:", accessBalance > 0 ? "✅ Yes" : "❌ No");

    return {
      escrowAddress,
      accessTokenAddress: ACCESS_TOKEN_ADDRESS,
      hasBeenWithdrawn,
      signerCanPublicWithdraw: accessBalance > 0
    };

  } catch (error) {
    console.error("\n❌ Helper failed:");
    console.error(error);
    throw error;
  }
}

main()
  .then((result) => {
    console.log("\n✅ Helper completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Helper failed:");
    console.error(error);
    process.exit(1);
  }); 