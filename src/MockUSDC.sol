// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Test stablecoin with public faucet. BSC testnet only.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin (Test)", "USDC") {}

    /// @notice Anyone can mint 10,000 USDC for testing.
    function faucet() external {
        _mint(msg.sender, 10_000 * 1e6);
    }

    /// @notice Mint arbitrary amount (for seeding reserve).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
