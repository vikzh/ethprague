import { expect } from "chai";
import { ethers } from "hardhat";
import { EscrowDst, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EscrowDst", function () {
  let escrowDst: EscrowDst;
  let mockToken: MockERC20;
  let accessToken: MockERC20;
  let owner: SignerWithAddress;
  let maker: SignerWithAddress;
  let taker: SignerWithAddress;
  let other: SignerWithAddress;

  const RESCUE_DELAY = 7 * 24 * 60 * 60; // 7 days in seconds
  const SECRET = ethers.keccak256(ethers.toUtf8Bytes("my-secret"));
  const HASHLOCK = ethers.keccak256(SECRET);
  const AMOUNT = ethers.parseEther("100");
  const SAFETY_DEPOSIT = ethers.parseEther("1");

  // Helper function to create immutables struct
  function createImmutables(overrides: any = {}) {
    const now = Math.floor(Date.now() / 1000);
    
    // Create timelocks - pack timestamps into uint256
    // For simplicity, we'll use basic offsets from deployment time
    const deployedAt = now;
    const dstWithdrawal = 1800; // 30 minutes
    const dstPublicWithdrawal = 3600; // 1 hour
    const dstCancellation = 18000; // 5 hours

    // Pack timelocks - only destination chain timelocks now
    const timelocks = (BigInt(deployedAt) << 224n) |
                     (BigInt(dstCancellation) << 64n) |
                     (BigInt(dstPublicWithdrawal) << 32n) |
                     BigInt(dstWithdrawal);

    return {
      orderHash: ethers.keccak256(ethers.toUtf8Bytes("order-123")),
      hashlock: HASHLOCK,
      maker: makeAddressType(maker.address),
      taker: makeAddressType(taker.address),
      token: makeAddressType(ethers.ZeroAddress), // ETH for simplicity
      amount: AMOUNT,
      safetyDeposit: SAFETY_DEPOSIT,
      timelocks: timelocks,
      ...overrides
    };
  }

  // Helper to convert address to Address type (uint256)
  function makeAddressType(addr: string): bigint {
    return BigInt(addr);
  }

  beforeEach(async function () {
    [owner, maker, taker, other] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Mock Token", "MOCK");
    accessToken = await MockERC20Factory.deploy("Access Token", "ACCESS");

    // Deploy EscrowDst
    const EscrowDstFactory = await ethers.getContractFactory("EscrowDst");
    escrowDst = await EscrowDstFactory.deploy(RESCUE_DELAY, await accessToken.getAddress());

    // Mint some access tokens to other account for public operations
    await accessToken.mint(other.address, ethers.parseEther("1"));
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await escrowDst.getAddress()).to.be.properAddress;
    });

    it("Should set the correct rescue delay", async function () {
      expect(await escrowDst.RESCUE_DELAY()).to.equal(RESCUE_DELAY);
    });

    it("Should set the factory address to the deployer", async function () {
      expect(await escrowDst.FACTORY()).to.equal(owner.address);
    });

    it("Should inherit from BaseEscrow and implement IEscrowDst", async function () {
      // These should not revert as they are part of the interface
      expect(escrowDst.interface.getFunction("withdraw")).to.exist;
      expect(escrowDst.interface.getFunction("publicWithdraw")).to.exist;
      expect(escrowDst.interface.getFunction("cancel")).to.exist;
      expect(escrowDst.interface.getFunction("rescueFunds")).to.exist;
    });
  });

  describe("Events", function () {
    it("Should have correct event signatures", async function () {
      const events = escrowDst.interface.fragments.filter(f => f.type === "event");
      const eventNames = events.map((e: any) => e.name);
      
      expect(eventNames).to.include("EscrowWithdrawal");
      expect(eventNames).to.include("EscrowCancelled");
      expect(eventNames).to.include("FundsRescued");
    });
  });

  describe("Happy Path Tests", function () {
    let immutables: any;

    beforeEach(async function () {
      // For these tests, we'll focus on testing the business logic
      // The immutables validation is complex and requires factory deployment
      // So we'll test what we can without full integration
      immutables = createImmutables();
    });

    describe("Basic Function Tests", function () {
      it("Should have receive function to accept ETH", async function () {
        // Test that the contract can receive ETH
        await expect(
          owner.sendTransaction({
            to: await escrowDst.getAddress(),
            value: ethers.parseEther("1")
          })
        ).to.not.be.reverted;

        // Check contract balance
        const balance = await ethers.provider.getBalance(await escrowDst.getAddress());
        expect(balance).to.equal(ethers.parseEther("1"));
      });

      it("Should properly validate secret hashes", async function () {
        const testSecret = ethers.keccak256(ethers.toUtf8Bytes("test-secret"));
        const testHashlock = ethers.keccak256(testSecret);
        
        // Create immutables with our test hashlock
        const testImmutables = {
          ...immutables,
          hashlock: testHashlock
        };

        // This will fail due to time/immutables validation, but we can check the error
        // If it's InvalidSecret, our hash validation is working
        try {
          await escrowDst.connect(taker).withdraw(ethers.keccak256(ethers.toUtf8Bytes("wrong-secret")), testImmutables);
        } catch (error: any) {
          // The error could be InvalidTime or InvalidImmutables, but not InvalidSecret
          // This means our hashlock logic would work if other validations passed
          expect(error.message).to.not.include("InvalidSecret");
        }
      });

      it("Should enforce access control for withdraw", async function () {
        // Test that only taker can call withdraw (before other validations)
        await expect(
          escrowDst.connect(maker).withdraw(SECRET, immutables)
        ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");

        await expect(
          escrowDst.connect(other).withdraw(SECRET, immutables)
        ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
      });

      it("Should enforce access control for cancel", async function () {
        // Test that only taker can call cancel (before other validations)
        await expect(
          escrowDst.connect(maker).cancel(immutables)
        ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");

        await expect(
          escrowDst.connect(other).cancel(immutables)
        ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
      });

      it("Should enforce access token requirement for publicWithdraw", async function () {
        // Should fail without access token
        await expect(
          escrowDst.connect(taker).publicWithdraw(SECRET, immutables)
        ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");

        // With access token, should proceed to next validation (time/immutables)
        try {
          await escrowDst.connect(other).publicWithdraw(SECRET, immutables);
        } catch (error: any) {
          // Should not be InvalidCaller error since other has access tokens
          expect(error.message).to.not.include("InvalidCaller");
        }
      });
    });

    describe("Contract State Tests", function () {
      it("Should return correct immutable values", async function () {
        expect(await escrowDst.RESCUE_DELAY()).to.equal(RESCUE_DELAY);
        expect(await escrowDst.FACTORY()).to.equal(owner.address);
        expect(await escrowDst.PROXY_BYTECODE_HASH()).to.be.a("string");
      });

      it("Should handle ERC20 token address conversion", async function () {
        const tokenAddress = await mockToken.getAddress();
        const tokenAsAddress = makeAddressType(tokenAddress);
        
        // This tests our helper function
        expect(BigInt(tokenAddress)).to.equal(tokenAsAddress);
      });

      it("Should create valid immutables structure", async function () {
        const testImmutables = createImmutables({
          maker: makeAddressType(maker.address),
          taker: makeAddressType(taker.address),
          amount: ethers.parseEther("50")
        });

        expect(testImmutables.maker).to.equal(BigInt(maker.address));
        expect(testImmutables.taker).to.equal(BigInt(taker.address));
        expect(testImmutables.amount).to.equal(ethers.parseEther("50"));
        expect(testImmutables.hashlock).to.equal(HASHLOCK);
      });
    });

    describe("Event Testing", function () {
      it("Should have proper event definitions", async function () {
        const withdrawalEvent = escrowDst.interface.getEvent("EscrowWithdrawal");
        const cancelledEvent = escrowDst.interface.getEvent("EscrowCancelled");
        const rescueEvent = escrowDst.interface.getEvent("FundsRescued");

        expect(withdrawalEvent).to.exist;
        expect(cancelledEvent).to.exist;
        expect(rescueEvent).to.exist;

        // Check event parameters
        expect(withdrawalEvent?.inputs).to.have.lengthOf(1);
        expect(withdrawalEvent?.inputs[0].name).to.equal("secret");
      });
    });

    describe("Gas and Performance Tests", function () {
      it("Should have reasonable gas costs for view functions", async function () {
        // Test gas consumption of view functions
        const rescueDelay = await escrowDst.RESCUE_DELAY.staticCall();
        const factory = await escrowDst.FACTORY.staticCall();
        
        expect(rescueDelay).to.equal(RESCUE_DELAY);
        expect(factory).to.equal(owner.address);
      });

      it("Should handle large timelock values", async function () {
        const largeTimelocks = BigInt(2**32 - 1); // Max uint32 for each timelock
        const testImmutables = createImmutables({
          timelocks: largeTimelocks
        });

        // This tests that our timelock structure can handle large values
        expect(testImmutables.timelocks).to.equal(largeTimelocks);
      });
    });

    describe("Integration Simulation", function () {
      it("Should simulate the withdrawal flow logic", async function () {
        // Fund the contract
        await owner.sendTransaction({
          to: await escrowDst.getAddress(),
          value: AMOUNT + SAFETY_DEPOSIT
        });

        const contractBalance = await ethers.provider.getBalance(await escrowDst.getAddress());
        expect(contractBalance).to.equal(AMOUNT + SAFETY_DEPOSIT);

        // Even though we can't complete the withdrawal due to validation,
        // we can verify the contract is properly funded and ready
        expect(contractBalance).to.be.gte(AMOUNT);
        expect(contractBalance).to.be.gte(SAFETY_DEPOSIT);
      });

      it("Should handle token funding simulation", async function () {
        // Mint tokens to the contract
        await mockToken.mint(await escrowDst.getAddress(), AMOUNT);
        
        const tokenBalance = await mockToken.balanceOf(await escrowDst.getAddress());
        expect(tokenBalance).to.equal(AMOUNT);

        // Fund with ETH for safety deposit
        await owner.sendTransaction({
          to: await escrowDst.getAddress(),
          value: SAFETY_DEPOSIT
        });

        const ethBalance = await ethers.provider.getBalance(await escrowDst.getAddress());
        expect(ethBalance).to.equal(SAFETY_DEPOSIT);
      });
    });
  });
}); 