// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICustodian
/// @notice Interface for asset backing providers.
///         Today: USDC reserve pool (SimulatedCustodian).
///         Tomorrow: Brink's gold vaults, IBKR ETF holdings, CME futures.
interface ICustodian {
    /// @notice Total value held for a specific asset (in USDC, 6 decimals).
    function totalAssetValue(bytes32 assetId) external view returns (uint256);

    /// @notice Hash of all holdings for on-chain proof of reserves.
    function reportHoldings() external view returns (bytes32);
}
