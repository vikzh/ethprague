// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AddressLib, Address } from "./libraries/AddressLib.sol";
import { ImmutablesLib } from "./libraries/ImmutablesLib.sol";
import { TimelocksLib, Timelocks } from "./libraries/TimelocksLib.sol";
import { IBaseEscrow } from "./interfaces/IBaseEscrow.sol";
import { IEscrowFactory } from "./interfaces/IEscrowFactory.sol";
import { EscrowDst } from "./EscrowDst.sol";

/**
 * @title Mock Escrow Factory for testing
 * @notice Minimal factory implementation for end-to-end testing of destination escrows
 */
contract MockEscrowFactory is IEscrowFactory {
    using SafeERC20 for IERC20;
    using AddressLib for Address;
    using TimelocksLib for Timelocks;

    address public immutable ESCROW_DST_IMPLEMENTATION;

    constructor(address _escrowDstImplementation) {
        ESCROW_DST_IMPLEMENTATION = _escrowDstImplementation;
    }

    /**
     * @notice Creates a new destination escrow contract
     */
    function createDstEscrow(IBaseEscrow.Immutables calldata dstImmutables) external payable override {
        address token = dstImmutables.token.get();
        
        // For ETH swaps, require total amount (swap amount + safety deposit)
        // For ERC20 swaps, require only safety deposit in ETH
        uint256 requiredEth = token == address(0) 
            ? dstImmutables.amount + dstImmutables.safetyDeposit 
            : dstImmutables.safetyDeposit;
            
        if (msg.value != requiredEth) {
            revert InsufficientEscrowBalance();
        }

        // Set deployment timestamp in immutables
        IBaseEscrow.Immutables memory immutables = dstImmutables;
        immutables.timelocks = immutables.timelocks.setDeployedAt(block.timestamp);

        // Compute salt and deploy escrow
        bytes32 salt = ImmutablesLib.hashMem(immutables);
        
        // Create minimal proxy bytecode
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            ESCROW_DST_IMPLEMENTATION,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        // Deploy with all ETH value (for ETH swaps this includes both amounts)
        address escrow = Create2.deploy(msg.value, salt, bytecode);

        // For ERC20 swaps, transfer tokens to the escrow
        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, escrow, dstImmutables.amount);
        }

        emit DstEscrowCreated(escrow, dstImmutables.hashlock, dstImmutables.taker);
    }

    /**
     * @notice Returns the deterministic address of the destination escrow
     */
    function addressOfEscrowDst(IBaseEscrow.Immutables calldata immutables) external view override returns (address) {
        // Need to use the same immutables that would be used in deployment (with deployment timestamp)
        // For prediction, we use the current block timestamp
        IBaseEscrow.Immutables memory modifiedImmutables = immutables;
        modifiedImmutables.timelocks = immutables.timelocks.setDeployedAt(block.timestamp);
        
        bytes32 salt = ImmutablesLib.hashMem(modifiedImmutables);
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            ESCROW_DST_IMPLEMENTATION,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        bytes32 bytecodeHash = keccak256(bytecode);
        return Create2.computeAddress(salt, bytecodeHash, address(this));
    }
} 