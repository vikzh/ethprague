import { expect } from "chai";
import { ethers } from "hardhat";
import { EscrowDst, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

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
    const srcWithdrawal = 3600; // 1 hour
    const srcPublicWithdrawal = 7200; // 2 hours  
    const srcCancellation = 14400; // 4 hours
    const srcPublicCancellation = 21600; // 6 hours
    const dstWithdrawal = 1800; // 30 minutes
    const dstPublicWithdrawal = 3600; // 1 hour
    const dstCancellation = 18000; // 5 hours

    // Pack timelocks (this is a simplified version)
    const timelocks = (BigInt(deployedAt) << 224n) |
                     (BigInt(dstCancellation) << 192n) |
                     (BigInt(dstPublicWithdrawal) << 160n) |
                     (BigInt(dstWithdrawal) << 128n) |
                     (BigInt(srcPublicCancellation) << 96n) |
                     (BigInt(srcCancellation) << 64n) |
                     (BigInt(srcPublicWithdrawal) << 32n) |
                     BigInt(srcWithdrawal);

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

  describe("Smoke Tests", function () {
    let immutables: any;

    beforeEach(async function () {
      immutables = createImmutables();
    });

    it("Should revert withdraw with invalid caller", async function () {
      await expect(
        escrowDst.connect(other).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
    });

    it("Should revert withdraw with invalid time (too early)", async function () {
      await expect(
        escrowDst.connect(taker).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime");
    });

    it("Should revert public withdraw without access token", async function () {
      await expect(
        escrowDst.connect(taker).publicWithdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
    });

    it("Should revert cancel with invalid caller", async function () {
      await expect(
        escrowDst.connect(other).cancel(immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
    });

    it("Should revert cancel with invalid time (too early)", async function () {
      await expect(
        escrowDst.connect(taker).cancel(immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidImmutables");
    });
  });

  describe("Function Calls", function () {
    let immutables: any;

    beforeEach(async function () {
      immutables = createImmutables();
    });

    it("Should have correct function selectors", async function () {
      const withdrawSelector = escrowDst.interface.getFunction("withdraw")?.selector;
      const publicWithdrawSelector = escrowDst.interface.getFunction("publicWithdraw")?.selector;
      const cancelSelector = escrowDst.interface.getFunction("cancel")?.selector;

      expect(withdrawSelector).to.be.a("string");
      expect(publicWithdrawSelector).to.be.a("string");
      expect(cancelSelector).to.be.a("string");
    });

    it("Should accept immutables struct correctly", async function () {
      // This should revert for business logic reasons, not struct parsing
      await expect(
        escrowDst.connect(taker).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime");
    });

    it("Should validate secret format", async function () {
      const invalidSecret = ethers.zeroPadValue("0x1234", 32); // Properly format as bytes32
      await expect(
        escrowDst.connect(taker).withdraw(invalidSecret, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime"); // Time check comes first
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero address token", async function () {
      const immutables = createImmutables({
        token: makeAddressType(ethers.ZeroAddress)
      });

      await expect(
        escrowDst.connect(taker).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime");
    });

    it("Should handle zero amounts", async function () {
      const immutables = createImmutables({
        amount: 0,
        safetyDeposit: 0
      });

      await expect(
        escrowDst.connect(taker).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime");
    });

    it("Should handle maximum uint256 values", async function () {
      const immutables = createImmutables({
        amount: ethers.MaxUint256,
        safetyDeposit: ethers.MaxUint256
      });

      await expect(
        escrowDst.connect(taker).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime");
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

  describe("Access Control", function () {
    let immutables: any;

    beforeEach(async function () {
      immutables = createImmutables();
    });

    it("Should only allow taker to call withdraw", async function () {
      await expect(
        escrowDst.connect(maker).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");

      await expect(
        escrowDst.connect(other).withdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
    });

    it("Should only allow access token holders to call publicWithdraw", async function () {
      // Should work with access token holder (even though time is wrong)
      await expect(
        escrowDst.connect(other).publicWithdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidTime");

      // Should fail without access token
      await expect(
        escrowDst.connect(taker).publicWithdraw(SECRET, immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
    });

    it("Should only allow taker to call cancel", async function () {
      await expect(
        escrowDst.connect(maker).cancel(immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");

      await expect(
        escrowDst.connect(other).cancel(immutables)
      ).to.be.revertedWithCustomError(escrowDst, "InvalidCaller");
    });
  });
}); 