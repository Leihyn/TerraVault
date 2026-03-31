// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TerraVault} from "../src/TerraVault.sol";
import {CommodityToken} from "../src/CommodityToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockPyth} from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract TerraVaultTest is Test {
    TerraVault public vault;
    MockUSDC public usdc;
    MockPyth public pyth;

    address public admin = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    bytes32 public constant GOLD_ID = keccak256("GOLD");
    bytes32 public constant SILVER_ID = keccak256("SILVER");
    bytes32 public constant GOLD_FEED = bytes32(uint256(1));
    bytes32 public constant SILVER_FEED = bytes32(uint256(2));

    function _createUpdate(bytes32 feedId, int64 price, int32 expo) internal view returns (bytes[] memory) {
        bytes[] memory data = new bytes[](1);
        data[0] = pyth.createPriceFeedUpdateData(
            feedId,
            price,
            100000,    // conf
            expo,
            price,     // emaPrice
            100000,    // emaConf
            uint64(block.timestamp)
        );
        return data;
    }

    function _setPrice(bytes32 feedId, int64 price, int32 expo) internal {
        bytes[] memory data = _createUpdate(feedId, price, expo);
        pyth.updatePriceFeeds(data);
    }

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth(300, 0); // 300s validity, 0 fee
        vault = new TerraVault(address(usdc), address(pyth));

        // Register assets
        vault.registerAsset(GOLD_ID, GOLD_FEED, "XAU", "Gold", 0);
        vault.registerAsset(SILVER_ID, SILVER_FEED, "XAG", "Silver", 0);

        // Set prices: Gold $3100, Silver $31 (expo = -8)
        _setPrice(GOLD_FEED, 310000000000, -8);   // $3100.00
        _setPrice(SILVER_FEED, 3100000000, -8);    // $31.00

        // KYC alice and bob
        vault.setKYC(alice, keccak256("alice-kyc"));
        vault.setKYC(bob, keccak256("bob-kyc"));

        // Fund alice and bob with USDC
        usdc.mint(alice, 100_000 * 1e6);
        usdc.mint(bob, 100_000 * 1e6);

        // Approve vault
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);

        // Seed reserve so sells can be fulfilled
        usdc.mint(admin, 1_000_000 * 1e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.seedReserve(GOLD_ID, 500_000 * 1e6);
        vault.seedReserve(SILVER_ID, 500_000 * 1e6);
    }

    // ---- Registration ----

    function test_RegisterAsset() public view {
        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        assertEq(gold.symbol, "XAU");
        assertEq(gold.name, "Gold");
        assertEq(gold.category, 0);
        assertTrue(gold.active);
        assertTrue(gold.token != address(0));
    }

    function test_RegisterAsset_DuplicateReverts() public {
        vm.expectRevert(TerraVault.AssetAlreadyExists.selector);
        vault.registerAsset(GOLD_ID, GOLD_FEED, "XAU", "Gold", 0);
    }

    function test_AssetCount() public view {
        assertEq(vault.assetCount(), 2);
    }

    function test_CommodityTokenMetadata() public view {
        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        CommodityToken token = CommodityToken(gold.token);
        assertEq(token.name(), "TerraVault Gold");
        assertEq(token.symbol(), "tvXAU");
        assertEq(token.decimals(), 18);
    }

    // ---- KYC ----

    function test_KYC() public view {
        assertEq(vault.kycHashes(alice), keccak256("alice-kyc"));
    }

    function test_BuyWithoutKYC_Reverts() public {
        address noKyc = address(0xDEAD);
        usdc.mint(noKyc, 10_000 * 1e6);
        vm.startPrank(noKyc);
        usdc.approve(address(vault), type(uint256).max);
        bytes[] memory empty = new bytes[](0);
        vm.expectRevert(TerraVault.NotKYCd.selector);
        vault.buy(GOLD_ID, 1000 * 1e6, empty);
        vm.stopPrank();
    }

    // ---- Buy ----

    function test_BuyGold() public {
        uint256 usdcAmount = 3100 * 1e6; // $3,100

        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, usdcAmount, empty);

        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        CommodityToken token = CommodityToken(gold.token);
        uint256 balance = token.balanceOf(alice);

        // Should get ~1 oz minus 0.2% fee
        assertGt(balance, 0.99e18);
        assertLt(balance, 1.01e18);

        // Check USDC moved
        assertEq(usdc.balanceOf(alice), 100_000 * 1e6 - usdcAmount);
    }

    function test_BuySilver() public {
        uint256 usdcAmount = 31 * 1e6; // $31

        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(SILVER_ID, usdcAmount, empty);

        TerraVault.Asset memory silver = vault.getAsset(SILVER_ID);
        CommodityToken token = CommodityToken(silver.token);
        uint256 balance = token.balanceOf(alice);

        assertGt(balance, 0.99e18);
        assertLt(balance, 1.01e18);
    }

    function test_BuyEmitsEvent() public {
        uint256 usdcAmount = 1000 * 1e6;

        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vm.expectEmit(true, true, false, false);
        emit TerraVault.CommodityBought(alice, GOLD_ID, 0, 0, 0, 0, bytes32(0), 0);
        vault.buy(GOLD_ID, usdcAmount, empty);
    }

    // ---- Sell ----

    function test_SellGold() public {
        // Buy first
        uint256 usdcAmount = 3100 * 1e6;
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, usdcAmount, empty);

        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        CommodityToken token = CommodityToken(gold.token);
        uint256 tokenBalance = token.balanceOf(alice);

        // Sell all
        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.sell(GOLD_ID, tokenBalance, empty);

        uint256 received = usdc.balanceOf(alice) - usdcBefore;

        // ~$3100 minus buy fee (0.2%) minus sell fee (0.1%) ≈ $3090
        assertGt(received, 3080 * 1e6);
        assertLt(received, 3100 * 1e6);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_SellEmitsEvent() public {
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, 1000 * 1e6, empty);

        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        uint256 bal = CommodityToken(gold.token).balanceOf(alice);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit TerraVault.CommoditySold(alice, GOLD_ID, 0, 0, 0, 0, bytes32(0), 0);
        vault.sell(GOLD_ID, bal, empty);
    }

    // ---- Fees ----

    function test_FeesAccumulate() public {
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, 10_000 * 1e6, empty);

        // Buy fee = 10000e6 * 20 / 10000 = 20e6
        assertEq(vault.totalFees(), 20 * 1e6);
    }

    function test_WithdrawFees() public {
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, 10_000 * 1e6, empty);

        address treasury = address(0xFEE);
        uint256 fees = vault.totalFees();
        vault.withdrawFees(treasury);

        assertEq(usdc.balanceOf(treasury), fees);
        assertEq(vault.totalFees(), 0);
    }

    // ---- Pause ----

    function test_PausePrevents() public {
        vault.setPaused(true);

        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vm.expectRevert(TerraVault.Paused.selector);
        vault.buy(GOLD_ID, 1000 * 1e6, empty);
    }

    // ---- Reserve health ----

    function test_ReserveHealth() public {
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, 1000 * 1e6, empty);

        (uint256 reserve, uint256 totalTokens, address tokenAddr) = vault.getReserveHealth(GOLD_ID);
        assertGt(reserve, 0);
        assertGt(totalTokens, 0);
        assertTrue(tokenAddr != address(0));
    }

    // ---- Proof of reserves ----

    function test_ReportHoldings() public view {
        bytes32 hash = vault.reportHoldings();
        assertTrue(hash != bytes32(0));
    }

    // ---- Price change PnL ----

    function test_PriceIncreaseProfitsUser() public {
        // Buy gold at $3100
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, 3100 * 1e6, empty);

        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        uint256 tokenBalance = CommodityToken(gold.token).balanceOf(alice);

        // Price goes up to $3200
        vm.warp(block.timestamp + 10);
        _setPrice(GOLD_FEED, 320000000000, -8);

        // Sell
        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.sell(GOLD_ID, tokenBalance, empty);
        uint256 received = usdc.balanceOf(alice) - usdcBefore;

        // Should get more than original $3100 (even with fees)
        assertGt(received, 3100 * 1e6);
    }

    function test_PriceDecreaseLossForUser() public {
        // Buy gold at $3100
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vault.buy(GOLD_ID, 3100 * 1e6, empty);

        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        uint256 tokenBalance = CommodityToken(gold.token).balanceOf(alice);

        // Price drops to $3000
        vm.warp(block.timestamp + 10);
        _setPrice(GOLD_FEED, 300000000000, -8);

        // Sell
        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.sell(GOLD_ID, tokenBalance, empty);
        uint256 received = usdc.balanceOf(alice) - usdcBefore;

        assertLt(received, 3100 * 1e6);
    }

    // ---- Edge cases ----

    function test_BuyZeroReverts() public {
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vm.expectRevert(TerraVault.ZeroAmount.selector);
        vault.buy(GOLD_ID, 0, empty);
    }

    function test_SellZeroReverts() public {
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vm.expectRevert(TerraVault.ZeroAmount.selector);
        vault.sell(GOLD_ID, 0, empty);
    }

    function test_BuyInactiveAssetReverts() public {
        bytes32 fakeId = keccak256("FAKE");
        vm.prank(alice);
        bytes[] memory empty = new bytes[](0);
        vm.expectRevert(TerraVault.AssetNotActive.selector);
        vault.buy(fakeId, 1000 * 1e6, empty);
    }

    function test_MultipleBuyers() public {
        bytes[] memory empty = new bytes[](0);

        vm.prank(alice);
        vault.buy(GOLD_ID, 5000 * 1e6, empty);

        vm.prank(bob);
        vault.buy(GOLD_ID, 3000 * 1e6, empty);

        TerraVault.Asset memory gold = vault.getAsset(GOLD_ID);
        CommodityToken token = CommodityToken(gold.token);

        assertGt(token.balanceOf(alice), 0);
        assertGt(token.balanceOf(bob), 0);
        assertGt(token.balanceOf(alice), token.balanceOf(bob));
    }

    // ---- Batch KYC ----

    function test_BatchSetKYC() public {
        address[] memory users = new address[](2);
        bytes32[] memory hashes = new bytes32[](2);
        users[0] = address(0x1);
        users[1] = address(0x2);
        hashes[0] = keccak256("kyc-1");
        hashes[1] = keccak256("kyc-2");

        vault.batchSetKYC(users, hashes);

        assertEq(vault.kycHashes(address(0x1)), keccak256("kyc-1"));
        assertEq(vault.kycHashes(address(0x2)), keccak256("kyc-2"));
    }

    // ---- Seed reserve ----

    function test_SeedReserve() public {
        bytes32 oilId = keccak256("OIL");
        bytes32 oilFeed = bytes32(uint256(3));
        vault.registerAsset(oilId, oilFeed, "WTI", "Crude Oil", 1);

        usdc.mint(admin, 100_000 * 1e6);
        vault.seedReserve(oilId, 50_000 * 1e6);

        TerraVault.Asset memory oil = vault.getAsset(oilId);
        assertEq(oil.totalReserve, 50_000 * 1e6);
    }

    // ---- Fee config ----

    function test_SetFees() public {
        vault.setFees(50, 25); // 0.5% buy, 0.25% sell
        assertEq(vault.buyFeeBps(), 50);
        assertEq(vault.sellFeeBps(), 25);
    }
}
