// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TerraVault} from "../src/TerraVault.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract Deploy is Script {
    // Pyth on BSC Testnet
    address constant PYTH_BSC_TESTNET = 0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb;

    // Pyth feed IDs (from hermes.pyth.network)
    bytes32 constant GOLD_FEED   = 0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2;
    bytes32 constant SILVER_FEED = 0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e;
    bytes32 constant PLAT_FEED   = 0x398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5;
    bytes32 constant COPPER_FEED = 0x636bedafa14a37912993f265eda22431a2be363ad41a10276424bbe1b7f508c4;
    bytes32 constant OIL_FEED    = 0x925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6;  // USOILSPOT
    bytes32 constant BRENT_FEED  = 0x27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a;  // UKOILSPOT
    bytes32 constant NATGAS_FEED = 0xcbbe4de47ffd7681b33db9ebdf22eeb899046cbe566be06e875bf088324787ce;  // NGDK6
    bytes32 constant WHEAT_FEED  = 0xa2c8737267dbe6118b2fc7f081484141a25f2753b19b3b5b0968ac3f05657a0c;  // WHK6

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy TerraVault
        TerraVault vault = new TerraVault(address(usdc), PYTH_BSC_TESTNET);
        console.log("TerraVault deployed at:", address(vault));

        // 3. Register commodities
        bytes32 goldId   = keccak256("GOLD");
        bytes32 silverId = keccak256("SILVER");
        bytes32 platId   = keccak256("PLATINUM");
        bytes32 copperId = keccak256("COPPER");
        bytes32 oilId    = keccak256("OIL");
        bytes32 brentId  = keccak256("BRENT");
        bytes32 gasId    = keccak256("NATGAS");
        bytes32 wheatId  = keccak256("WHEAT");

        vault.registerAsset(goldId,   GOLD_FEED,   "XAU",  "Gold",         0);
        vault.registerAsset(silverId, SILVER_FEED,  "XAG",  "Silver",       0);
        vault.registerAsset(platId,   PLAT_FEED,    "XPT",  "Platinum",     0);
        vault.registerAsset(copperId, COPPER_FEED,  "XCU",  "Copper",       2);
        vault.registerAsset(oilId,    OIL_FEED,     "WTI",  "Crude Oil",    1);
        vault.registerAsset(brentId,  BRENT_FEED,   "BRNT", "Brent Crude",  1);
        vault.registerAsset(gasId,    NATGAS_FEED,  "NG",   "Natural Gas",  1);
        vault.registerAsset(wheatId,  WHEAT_FEED,   "WHT",  "Wheat",        3);

        console.log("8 commodity assets registered");

        // 4. Seed reserve with 500k mock USDC per asset
        uint256 seedAmount = 500_000 * 1e6;
        usdc.mint(deployer, seedAmount * 8);
        usdc.approve(address(vault), type(uint256).max);

        vault.seedReserve(goldId,   seedAmount);
        vault.seedReserve(silverId, seedAmount);
        vault.seedReserve(platId,   seedAmount);
        vault.seedReserve(copperId, seedAmount);
        vault.seedReserve(oilId,    seedAmount);
        vault.seedReserve(brentId,  seedAmount);
        vault.seedReserve(gasId,    seedAmount);
        vault.seedReserve(wheatId,  seedAmount);

        console.log("Reserve seeded: 500k USDC per asset (4M total)");

        // 5. KYC the deployer for testing
        vault.setKYC(deployer, keccak256(abi.encodePacked("deployer-kyc-", deployer)));
        console.log("Deployer KYC set");

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: BSC Testnet (Chain ID 97)");
        console.log("MockUSDC:", address(usdc));
        console.log("TerraVault:", address(vault));
        console.log("Assets: 8 commodities registered");
        console.log("Reserve: 4,000,000 USDC seeded");
        console.log("========================\n");
    }
}
