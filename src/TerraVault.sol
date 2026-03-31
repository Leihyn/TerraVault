// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {ICustodian} from "./ICustodian.sol";
import {CommodityToken} from "./CommodityToken.sol";

/// @title TerraVault
/// @notice On-chain commodity marketplace on BNB Chain.
///         Users buy/sell tokenized commodity exposure using USDC.
///         Prices from Pyth Network. Every action compliance-attested.
contract TerraVault is Ownable, ReentrancyGuard, ICustodian {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Asset {
        bytes32 pythFeedId;
        address token;          // CommodityToken address
        string symbol;          // "XAU", "XAG", "WTI", etc.
        string name;            // "Gold", "Silver", "Crude Oil", etc.
        uint8 category;         // 0=precious, 1=energy, 2=industrial, 3=agriculture
        bool active;
        uint256 totalMinted;    // total commodity tokens outstanding
        uint256 totalReserve;   // USDC backing this asset
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IERC20 public immutable usdc;
    IPyth public immutable pyth;

    uint256 public constant MAX_STALENESS = 300; // 5 minutes
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public buyFeeBps = 20;   // 0.2%
    uint256 public sellFeeBps = 10;  // 0.1%

    bytes32[] public assetIds;
    mapping(bytes32 => Asset) public assets;
    mapping(address => bytes32) public kycHashes;

    uint256 public totalFees;       // accumulated protocol fees in USDC
    bool public paused;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AssetRegistered(bytes32 indexed assetId, string symbol, string name, address token);
    event CommodityBought(
        address indexed buyer,
        bytes32 indexed assetId,
        uint256 usdcAmount,
        uint256 tokensReceived,
        int64 oraclePrice,
        uint256 fee,
        bytes32 kycHash,
        uint256 timestamp
    );
    event CommoditySold(
        address indexed seller,
        bytes32 indexed assetId,
        uint256 tokenAmount,
        uint256 usdcReceived,
        int64 oraclePrice,
        uint256 fee,
        bytes32 kycHash,
        uint256 timestamp
    );
    event KYCSet(address indexed user, bytes32 kycHash);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Paused();
    error NotKYCd();
    error AssetNotActive();
    error AssetAlreadyExists();
    error ZeroAmount();
    error InsufficientReserve(uint256 available, uint256 requested);
    error InvalidPrice();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyKYCd() {
        if (kycHashes[msg.sender] == bytes32(0)) revert NotKYCd();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address usdc_, address pyth_) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
        pyth = IPyth(pyth_);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Register a new commodity asset.
    function registerAsset(
        bytes32 assetId,
        bytes32 pythFeedId,
        string calldata symbol,
        string calldata name_,
        uint8 category
    ) external onlyOwner {
        if (assets[assetId].active) revert AssetAlreadyExists();

        // Deploy a new CommodityToken for this asset
        CommodityToken token = new CommodityToken(
            string.concat("TerraVault ", name_),
            string.concat("tv", symbol),
            address(this)
        );

        assets[assetId] = Asset({
            pythFeedId: pythFeedId,
            token: address(token),
            symbol: symbol,
            name: name_,
            category: category,
            active: true,
            totalMinted: 0,
            totalReserve: 0
        });

        assetIds.push(assetId);
        emit AssetRegistered(assetId, symbol, name_, address(token));
    }

    /// @notice Set KYC hash for a user. Only admin.
    function setKYC(address user, bytes32 kycHash) external onlyOwner {
        kycHashes[user] = kycHash;
        emit KYCSet(user, kycHash);
    }

    /// @notice Batch set KYC for multiple users.
    function batchSetKYC(address[] calldata users, bytes32[] calldata hashes) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            kycHashes[users[i]] = hashes[i];
            emit KYCSet(users[i], hashes[i]);
        }
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
    }

    function setFees(uint256 buyFeeBps_, uint256 sellFeeBps_) external onlyOwner {
        buyFeeBps = buyFeeBps_;
        sellFeeBps = sellFeeBps_;
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 amount = totalFees;
        totalFees = 0;
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit FeesWithdrawn(to, amount);
    }

    /// @notice Seed the reserve for an asset (admin deposits USDC backing).
    function seedReserve(bytes32 assetId, uint256 amount) external onlyOwner {
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        assets[assetId].totalReserve += amount;
    }

    // -------------------------------------------------------------------------
    // User actions
    // -------------------------------------------------------------------------

    /// @notice Buy commodity tokens with USDC.
    /// @param assetId The asset to buy.
    /// @param usdcAmount Amount of USDC to spend (6 decimals).
    /// @param pythUpdateData Pyth price update data (from Hermes API).
    function buy(
        bytes32 assetId,
        uint256 usdcAmount,
        bytes[] calldata pythUpdateData
    ) external payable nonReentrant whenNotPaused onlyKYCd {
        if (usdcAmount == 0) revert ZeroAmount();
        Asset storage asset = assets[assetId];
        if (!asset.active) revert AssetNotActive();

        // Update and read Pyth price
        _updatePythPrice(pythUpdateData);
        (int64 price, uint64 conf, int32 expo) = _getPythPrice(asset.pythFeedId);
        if (price <= 0) revert InvalidPrice();

        // Calculate fee
        uint256 fee = (usdcAmount * buyFeeBps) / BPS_DENOMINATOR;
        uint256 netUsdcAmount = usdcAmount - fee;

        // Calculate commodity tokens to mint.
        // price is in format: price * 10^expo (expo is negative, e.g. -8)
        // We want: tokensOut = netUsdcAmount / priceInUsdc
        // USDC has 6 decimals, commodity tokens have 18 decimals.
        // priceInUsdc = price * 10^(expo + 6) [to convert to 6-decimal USDC per unit]
        // tokensOut (18 dec) = netUsdcAmount * 10^18 / (price * 10^(expo + 6))
        //                    = netUsdcAmount * 10^(18 - expo - 6) / price
        //                    = netUsdcAmount * 10^(12 - expo) / price
        uint256 absExpo = uint256(uint32(expo < 0 ? -expo : expo));
        uint256 tokensOut;
        if (expo < 0) {
            tokensOut = (netUsdcAmount * 10 ** (12 + absExpo)) / uint256(uint64(price));
        } else {
            tokensOut = (netUsdcAmount * 10 ** 12) / (uint256(uint64(price)) * 10 ** absExpo);
        }

        if (tokensOut == 0) revert ZeroAmount();

        // Transfer USDC from buyer
        if (!usdc.transferFrom(msg.sender, address(this), usdcAmount)) revert TransferFailed();

        // Update state
        asset.totalReserve += netUsdcAmount;
        asset.totalMinted += tokensOut;
        totalFees += fee;

        // Mint commodity tokens
        CommodityToken(asset.token).mint(msg.sender, tokensOut);

        emit CommodityBought(
            msg.sender,
            assetId,
            usdcAmount,
            tokensOut,
            price,
            fee,
            kycHashes[msg.sender],
            block.timestamp
        );
    }

    /// @notice Sell commodity tokens for USDC.
    /// @param assetId The asset to sell.
    /// @param tokenAmount Amount of commodity tokens to sell (18 decimals).
    /// @param pythUpdateData Pyth price update data.
    function sell(
        bytes32 assetId,
        uint256 tokenAmount,
        bytes[] calldata pythUpdateData
    ) external payable nonReentrant whenNotPaused onlyKYCd {
        if (tokenAmount == 0) revert ZeroAmount();
        Asset storage asset = assets[assetId];
        if (!asset.active) revert AssetNotActive();

        // Update and read Pyth price
        _updatePythPrice(pythUpdateData);
        (int64 price, uint64 conf, int32 expo) = _getPythPrice(asset.pythFeedId);
        if (price <= 0) revert InvalidPrice();

        // Calculate USDC value of tokens.
        // usdcOut = tokenAmount * priceInUsdc / 10^18
        // priceInUsdc = price * 10^(expo + 6)
        // usdcOut = tokenAmount * price * 10^(expo + 6) / 10^18
        //         = tokenAmount * price / 10^(12 - expo)  [when expo is negative]
        uint256 absExpo = uint256(uint32(expo < 0 ? -expo : expo));
        uint256 grossUsdcOut;
        if (expo < 0) {
            grossUsdcOut = (tokenAmount * uint256(uint64(price))) / 10 ** (12 + absExpo);
        } else {
            grossUsdcOut = (tokenAmount * uint256(uint64(price)) * 10 ** absExpo) / 10 ** 12;
        }

        // Calculate fee
        uint256 fee = (grossUsdcOut * sellFeeBps) / BPS_DENOMINATOR;
        uint256 netUsdcOut = grossUsdcOut - fee;

        // Check reserve has enough (pool solvency)
        if (asset.totalReserve < netUsdcOut) {
            revert InsufficientReserve(asset.totalReserve, netUsdcOut);
        }

        // Burn commodity tokens
        CommodityToken(asset.token).burn(msg.sender, tokenAmount);

        // Update state
        asset.totalReserve -= netUsdcOut;
        asset.totalMinted -= tokenAmount;
        totalFees += fee;

        // Transfer USDC to seller
        if (!usdc.transfer(msg.sender, netUsdcOut)) revert TransferFailed();

        emit CommoditySold(
            msg.sender,
            assetId,
            tokenAmount,
            netUsdcOut,
            price,
            fee,
            kycHashes[msg.sender],
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Get the number of registered assets.
    function assetCount() external view returns (uint256) {
        return assetIds.length;
    }

    /// @notice Get all asset IDs.
    function getAssetIds() external view returns (bytes32[] memory) {
        return assetIds;
    }

    /// @notice Get full asset info.
    function getAsset(bytes32 assetId) external view returns (Asset memory) {
        return assets[assetId];
    }

    /// @notice Proof of reserves: for each asset, compare reserve to obligation.
    function getReserveHealth(bytes32 assetId) external view returns (
        uint256 reserve,
        uint256 totalTokens,
        address tokenAddress
    ) {
        Asset memory asset = assets[assetId];
        return (asset.totalReserve, asset.totalMinted, asset.token);
    }

    // -------------------------------------------------------------------------
    // ICustodian implementation
    // -------------------------------------------------------------------------

    function totalAssetValue(bytes32 assetId) external view override returns (uint256) {
        return assets[assetId].totalReserve;
    }

    function reportHoldings() external view override returns (bytes32) {
        // Hash of all asset reserves for on-chain proof of reserves
        bytes memory data;
        for (uint256 i = 0; i < assetIds.length; i++) {
            bytes32 id = assetIds[i];
            data = abi.encodePacked(data, id, assets[id].totalReserve, assets[id].totalMinted);
        }
        return keccak256(data);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _updatePythPrice(bytes[] calldata pythUpdateData) internal {
        if (pythUpdateData.length > 0) {
            uint256 fee = pyth.getUpdateFee(pythUpdateData);
            pyth.updatePriceFeeds{value: fee}(pythUpdateData);
        }
    }

    function _getPythPrice(bytes32 feedId) internal view returns (int64, uint64, int32) {
        PythStructs.Price memory p = pyth.getPriceNoOlderThan(feedId, MAX_STALENESS);
        return (p.price, p.conf, p.expo);
    }

    /// @notice Accept BNB for Pyth update fees.
    receive() external payable {}
}
