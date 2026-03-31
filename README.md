# TerraVault

**Commodity markets for the world. Not just Wall Street.**

$500 billion in commodity derivatives trade every day. Gold, oil, copper, wheat. The raw materials that power the global economy. Who trades them? Banks, hedge funds, institutions with $10,000 minimums and accredited investor requirements.

Who doesn't? The 4 billion people in emerging markets where these commodities are actually produced and consumed. The coffee farmer who can't hedge price risk. The manufacturer who absorbs 15% copper swings. The family that wants gold exposure but can't access commodity ETFs.

TerraVault removes the barriers. Deposit stablecoins, buy commodity exposure, hedge your risk. No brokerage account, no minimum balance, no accreditation. One wallet, one click, one world.

**[Live on BSC Testnet](https://testnet.bscscan.com/address/0xE9d35D80c7C5DD0CBf8D956e4293Fbf3F28D080d)** | 25/25 tests | 8 commodity assets | x402 micropayments

---

## How It Works

```
1. Connect wallet (BSC Testnet)
2. Mint test USDC from faucet
3. Browse 8 commodities with live Pyth prices
4. Click "Trade" → enter USDC amount → receive commodity tokens
5. Portfolio tracks live value and P&L
6. Sell anytime → tokens burned → USDC returned at current price
```

Every buy and sell emits a compliance attestation on-chain: who traded, what asset, at what price, their KYC hash, and a timestamp. Fully auditable.

## Commodities

| Category | Asset | Token | Oracle | Status |
|----------|-------|-------|--------|--------|
| Precious Metals | Gold | tvXAU | Pyth XAU/USD | Live |
| Precious Metals | Silver | tvXAG | Pyth XAG/USD | Live |
| Precious Metals | Platinum | tvXPT | Pyth XPT/USD | Live |
| Industrial | Copper | tvXCU | Pyth XCU/USD | Market Hours |
| Energy | Crude Oil (WTI) | tvWTI | Pyth USOILSPOT/USD | Live |
| Energy | Brent Crude | tvBRNT | Pyth UKOILSPOT/USD | Live |
| Energy | Natural Gas | tvNG | Pyth NGDK6/USD | Market Hours |
| Agriculture | Wheat | tvWHT | Pyth WHK6/USD | Market Hours |

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Frontend (Next.js 16)                │
│  Immersive market │ Portfolio │ x402 trade flow   │
│  Live Pyth prices │ RainbowKit │ Terra design     │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│           x402 API Server (Express)               │
│  Buy/sell endpoints │ AI forecasts │ Fee gateway   │
│  402 payment protocol │ Signature verification    │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│            TerraVault.sol (BSC Testnet)            │
│                                                    │
│  Asset Registry ── 8 commodities + Pyth feed IDs  │
│  Buy/Sell ─────── mint/burn commodity ERC-20s      │
│  Reserve ──────── USDC backing (ICustodian)        │
│  Compliance ───── KYC gating + attestation events  │
│  Fees ─────────── 0.2% buy / 0.1% sell             │
└──────────────────────┬───────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Pyth Network   │
              │  8 commodity    │
              │  price feeds    │
              └─────────────────┘
```

## ICustodian: The Path to Real Backing

TerraVault implements `ICustodian`, a pluggable interface for asset backing.

```solidity
interface ICustodian {
    function totalAssetValue(bytes32 assetId) external view returns (uint256);
    function reportHoldings() external view returns (bytes32);
}
```

| Phase | Backing | Timeline |
|-------|---------|----------|
| **Phase 1** (now) | USDC reserve pool (simulated custodian) | Deployed |
| **Phase 2** | ETF custodian, holds GLD/SLV via brokerage API | 3 months |
| **Phase 3** | Futures custodian, CME gold/oil futures via regulated broker | 6 months |

The on-chain layer (tokenization, KYC, attestations, pricing) stays the same. Only the backing provider changes. The contract is already architected for it.

## Asset Expansion Roadmap

The contract's `registerAsset()` function adds new commodities in a single transaction. Pyth Network has 30+ commodity feeds ready to integrate.

| Phase | Assets | Count |
|-------|--------|-------|
| **Now** | Gold, Silver, Platinum, Oil (WTI/Brent), Copper, NatGas, Wheat | 8 |
| **Q2** | Palladium, Aluminum, Nickel, Cobalt, Lithium, Cocoa, Coffee, Soybeans, Corn, Lumber | +10 |
| **Q3** | Uranium, Tin, Zinc, Lead, Cotton, Sugar, Cattle, Rice, Iron Ore | +9 |
| **Q4** | Carbon credits, Rare earth indices, Water futures, Freight rates | +4 |

All feeds exist on Pyth. No contract changes needed, just `registerAsset()` calls.

## x402 Micropayments

Every trade flows through the x402 payment protocol. No subscriptions. No accounts. Pay-per-use.

```
POST /api/buy/gold  →  402 Payment Required
                    →  Sign payment with wallet
                    →  Server verifies signature
                    →  Trade executes on-chain
```

| Service | Fee |
|---------|-----|
| Buy commodity | 0.2% of notional |
| Sell commodity | 0.1% of notional |
| AI price forecast | $0.10 flat |

## Revenue Model

```
At $1M monthly volume:
  Trading fees:  ~$3,000/month
  Forecasts:     ~$500/month
  Total:         ~$3,500/month from day one

No token. No governance. Just trading fees.
```

## Deployed Contracts (BSC Testnet)

| Contract | Address |
|----------|---------|
| MockUSDC | [`0x33CF3b0BED8bD93aA4E1be0c0cE598858435c815`](https://testnet.bscscan.com/address/0x33CF3b0BED8bD93aA4E1be0c0cE598858435c815) |
| TerraVault | [`0xE9d35D80c7C5DD0CBf8D956e4293Fbf3F28D080d`](https://testnet.bscscan.com/address/0xE9d35D80c7C5DD0CBf8D956e4293Fbf3F28D080d) |

## Quick Start

### Contracts

```bash
forge build
forge test  # 25/25 passing

# Deploy to BSC Testnet
cp .env.example .env  # add private key
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 \
  --broadcast --legacy
```

### API Server

```bash
cd api
npm install
cp .env.example .env  # add contract addresses
npm run dev  # starts on port 3001
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # add contract addresses
npm run dev  # starts on port 3000
```

## Verified End-to-End

- Bought 0.218 oz tvGOLD with $1,000 USDC at live Pyth price ($4,570/oz)
- Sold half: 0.109 oz tvGOLD returned $498 USDC
- Bought tvSILVER, tvPLATINUM, tvOIL, tvBRENT, all confirmed on-chain
- Compliance attestation events emitted for every transaction
- 25/25 smart contract tests passing

## Tech Stack

- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin, Pyth SDK
- **Oracle:** Pyth Network (8 commodity feeds on BSC)
- **API:** Express, TypeScript, x402 payment protocol, viem
- **Frontend:** Next.js 16, TypeScript, Tailwind, wagmi, RainbowKit
- **Design:** Terra, Fraunces serif, amber/rose gradients, Afrofuturist aesthetic
- **Chain:** BNB Smart Chain (Testnet)

## License

MIT

---

*Built for RWA Demo Day @ Hong Kong Web3 Festival 2026*
