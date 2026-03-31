// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TerraVault} from "../src/TerraVault.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DeployV2 is Script {
    // Our MockPyth on BSC Testnet
    address constant MOCK_PYTH = 0xa0c73D8B4Ee384F092f4015daF86021B63ae60b8;

    // Feed IDs. These match what the relayer will push.
    bytes32 constant GOLD_FEED     = bytes32(uint256(1));
    bytes32 constant SILVER_FEED   = bytes32(uint256(2));
    bytes32 constant PLAT_FEED     = bytes32(uint256(3));
    bytes32 constant PALLADIUM_FEED = bytes32(uint256(4));
    bytes32 constant OIL_FEED      = bytes32(uint256(5));
    bytes32 constant BRENT_FEED    = bytes32(uint256(6));
    bytes32 constant COPPER_FEED   = bytes32(uint256(7));
    bytes32 constant NATGAS_FEED   = bytes32(uint256(8));
    bytes32 constant WHEAT_FEED    = bytes32(uint256(9));
    bytes32 constant ALUMINUM_FEED = bytes32(uint256(10));
    bytes32 constant NICKEL_FEED   = bytes32(uint256(11));
    bytes32 constant TIN_FEED      = bytes32(uint256(12));
    bytes32 constant COFFEE_FEED   = bytes32(uint256(13));
    bytes32 constant COCOA_FEED    = bytes32(uint256(14));

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:", address(usdc));

        // 2. Deploy TerraVault with MockPyth
        TerraVault vault = new TerraVault(address(usdc), MOCK_PYTH);
        console.log("TerraVault:", address(vault));

        // 3. Register ALL 14 commodities
        vault.registerAsset(keccak256("GOLD"),      GOLD_FEED,      "XAU",  "Gold",         0);
        vault.registerAsset(keccak256("SILVER"),     SILVER_FEED,    "XAG",  "Silver",       0);
        vault.registerAsset(keccak256("PLATINUM"),   PLAT_FEED,      "XPT",  "Platinum",     0);
        vault.registerAsset(keccak256("PALLADIUM"),  PALLADIUM_FEED, "XPD",  "Palladium",    0);
        vault.registerAsset(keccak256("OIL"),        OIL_FEED,       "WTI",  "Crude Oil",    1);
        vault.registerAsset(keccak256("BRENT"),      BRENT_FEED,     "BRNT", "Brent Crude",  1);
        vault.registerAsset(keccak256("COPPER"),     COPPER_FEED,    "XCU",  "Copper",       2);
        vault.registerAsset(keccak256("NATGAS"),     NATGAS_FEED,    "NG",   "Natural Gas",  1);
        vault.registerAsset(keccak256("WHEAT"),      WHEAT_FEED,     "WHT",  "Wheat",        3);
        vault.registerAsset(keccak256("ALUMINUM"),   ALUMINUM_FEED,  "XAL",  "Aluminum",     2);
        vault.registerAsset(keccak256("NICKEL"),     NICKEL_FEED,    "NI",   "Nickel",       2);
        vault.registerAsset(keccak256("TIN"),        TIN_FEED,       "SN",   "Tin",          2);
        vault.registerAsset(keccak256("COFFEE"),     COFFEE_FEED,    "KC",   "Coffee",       3);
        vault.registerAsset(keccak256("COCOA"),      COCOA_FEED,     "CC",   "Cocoa",        3);

        console.log("14 commodity assets registered");

        // 4. Seed reserve
        uint256 seedAmount = 500_000 * 1e6;
        usdc.mint(deployer, seedAmount * 14);
        usdc.approve(address(vault), type(uint256).max);

        vault.seedReserve(keccak256("GOLD"),      seedAmount);
        vault.seedReserve(keccak256("SILVER"),     seedAmount);
        vault.seedReserve(keccak256("PLATINUM"),   seedAmount);
        vault.seedReserve(keccak256("PALLADIUM"),  seedAmount);
        vault.seedReserve(keccak256("OIL"),        seedAmount);
        vault.seedReserve(keccak256("BRENT"),      seedAmount);
        vault.seedReserve(keccak256("COPPER"),     seedAmount);
        vault.seedReserve(keccak256("NATGAS"),     seedAmount);
        vault.seedReserve(keccak256("WHEAT"),      seedAmount);
        vault.seedReserve(keccak256("ALUMINUM"),   seedAmount);
        vault.seedReserve(keccak256("NICKEL"),     seedAmount);
        vault.seedReserve(keccak256("TIN"),        seedAmount);
        vault.seedReserve(keccak256("COFFEE"),     seedAmount);
        vault.seedReserve(keccak256("COCOA"),      seedAmount);

        console.log("Reserve seeded: 500k USDC per asset (7M total)");

        // 5. KYC deployer
        vault.setKYC(deployer, keccak256(abi.encodePacked("deployer-kyc-", deployer)));

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT V2 SUMMARY ===");
        console.log("MockPyth:", MOCK_PYTH);
        console.log("MockUSDC:", address(usdc));
        console.log("TerraVault:", address(vault));
        console.log("Assets: 14 commodities");
        console.log("=============================\n");
    }
}
