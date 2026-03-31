# TerraVault | Pitch Deck Script

## Slide 1: The Problem (30 seconds)

**Visual:** Split screen. Bloomberg terminal on left, empty phone screen on right.

**Script:**
"$500 billion in commodity derivatives trade every day. Gold, oil, copper, wheat. The raw materials that power the global economy.

Who trades them? Goldman Sachs. JP Morgan. Citadel.

Who doesn't? The coffee farmer in Kenya who watches prices crash 30% and loses her income. The manufacturer in Lagos who absorbs 15% copper price swings every quarter. The family in Manila who wants to protect savings with a little gold exposure.

4 billion people live in countries where these commodities are produced and consumed. Almost none of them can access these markets. You need a $10,000 brokerage account, $200,000 in accredited net worth, and a bank that serves your country. The infrastructure excludes them by design."

---

## Slide 2: The Solution (20 seconds)

**Visual:** TerraVault logo + tagline: "Commodity markets for the world. Not just Wall Street."

**Script:**
"TerraVault is an on-chain commodity marketplace. Deposit stablecoins, buy exposure to gold, silver, oil, platinum, and more. Every transaction is KYC-gated and compliance-attested. Prices from Pyth Network oracles, updating every second.

No brokerage account. No minimum balance. No accreditation. Connect a wallet, buy gold. That's it."

---

## Slide 3: Live Demo (90 seconds)

**Visual:** Screen recording of the live app.

**Script:**
"Let me show you TerraVault running live on BNB Chain testnet.

[Open app, show the immersive hero with the globe]
This is our marketplace. 8 commodities across 4 categories: precious metals, energy, industrial, agriculture. All prices live from Pyth Network.

[Click 'Mint 10K USDC']
I'm minting test USDC from our faucet. One click.

[Click 'Trade XAU' on Gold card]
Now I'm buying gold. I enter $1,000 USDC. The modal shows me I'll receive approximately 0.218 ounces of tvGOLD at the current Pyth price of $4,570.

[Show fee breakdown]
The fee is 0.2%, just $2.00. No hidden costs. No subscription. The protocol earns revenue from every trade.

[Confirm trade]
I sign the transaction. tvGOLD tokens are minted to my wallet. I now own tokenized gold exposure on BNB Chain.

[Navigate to Portfolio]
My portfolio shows my holdings with live value. If gold goes up 3%, my tvGOLD is worth 3% more. I can sell anytime. Tokens are burned, and USDC returns to my wallet.

[Show attestation event on BSCScan]
Every trade emits a compliance attestation on-chain: who traded, what asset, at what price, the KYC hash, and a timestamp. Fully auditable. Regulator-friendly."

---

## Slide 4: Architecture (20 seconds)

**Visual:** Architecture diagram.

**Script:**
"The stack is clean. Solidity smart contract on BNB Chain with 25 passing tests. Pyth Network provides oracle prices for all 8 commodities. Frontend in Next.js with RainbowKit wallet connection. x402 micropayment API for trading fees.

The key architectural decision: ICustodian, a pluggable interface for asset backing. Today, a USDC reserve pool backs all tokens. Tomorrow, swap it for real commodity custody without changing a single line of the trading logic."

---

## Slide 5: Custodian Roadmap (20 seconds)

**Visual:** Three phases diagram.

**Script:**
"We're honest. Today's demo runs on a simulated custodian. Here's the path to real backing:

Phase 1 (now): USDC reserve pool. Proves the on-chain layer works.
Phase 2 (3 months): partner with an ETF custodian. When users buy tvGOLD, the protocol buys GLD shares via brokerage API. Same contract, real backing.
Phase 3 (6 months): direct commodity futures. CME gold futures, regulated broker. Most capital-efficient backing.

The ICustodian interface is 5 lines of code. But it's the architectural proof that this isn't a hackathon toy. It's infrastructure designed for production custody."

---

## Slide 6: Revenue Model (15 seconds)

**Visual:** Revenue breakdown.

**Script:**
"Revenue from day one. No token. No governance. Just trading fees.

0.2% on buys. 0.1% on sells. $0.10 per AI forecast.

At $1 million monthly volume: $3,000 per month in protocol revenue. Self-sustaining without grants or token sales. The business model is the product."

---

## Slide 7: Why BNB Chain (15 seconds)

**Visual:** BNB Chain logo + stats.

**Script:**
"BNB Chain is the right home for commodity RWA. Three reasons:

Gas costs under $0.01, critical for emerging market users where $5 in gas is a day's wages.
Pyth Network integration: 8 commodity feeds live on BSC.
Largest DeFi user base in emerging markets, the exact audience TerraVault serves.

We're not porting from another chain. We built this for BNB Chain."

---

## Slide 8: Team + Ask (15 seconds)

**Visual:** GitHub profile, prior projects.

**Script:**
"I'm Faruq, a solo full-stack builder. My track record:
- Basel: Structured FX products on Solana. 23/23 tests, live on devnet.
- BlindBond: FHE-encrypted bond auctions on Arbitrum. 17 tests, deployed.
- TruthBounty: Prediction market reputation. 2nd place Seedify hackathon.

What I'm looking for from this program:
1. BNB Chain RWA incentive program access: fast-track for technical and compliance guidance.
2. Custodian partner introductions: the ETF brokerage or commodity custodian for Phase 2.
3. ICC incubation: the $100K package to accelerate from testnet to mainnet.

TerraVault is live on BSC testnet. 25 tests passing. 8 assets registered. Real Pyth prices. Working trades. The infrastructure is built. The custody partnerships are next."

---

## Total: ~4 minutes

For the 8-minute Demo Day pitch, double the demo time and add Q&A buffer.
