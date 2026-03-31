import { createPublicClient, createWalletClient, http, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

// ---- Config ----
const MOCK_PYTH = "0xa0c73D8B4Ee384F092f4015daF86021B63ae60b8";
const POLL_INTERVAL = 30_000; // 30 seconds

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const publicClient = createPublicClient({ chain: bscTestnet, transport: http("https://data-seed-prebsc-1-s1.binance.org:8545") });
const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http("https://data-seed-prebsc-1-s1.binance.org:8545") });

// Feed IDs — must match DeployV2.s.sol
const FEEDS = [
  { id: 1n,  name: "Gold",      symbol: "XAU",  source: "pyth", pythFeed: "765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2", expo: -8 },
  { id: 2n,  name: "Silver",    symbol: "XAG",  source: "pyth", pythFeed: "f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e", expo: -8 },
  { id: 3n,  name: "Platinum",  symbol: "XPT",  source: "pyth", pythFeed: "398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5", expo: -8 },
  { id: 4n,  name: "Palladium", symbol: "XPD",  source: "pyth", pythFeed: "80367e9664197f37d89a07a804dffd2101c479c7c4e8490501bc9d9e1e7f9021", expo: -8 },
  { id: 5n,  name: "WTI Oil",   symbol: "WTI",  source: "pyth", pythFeed: "925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6", expo: -8 },
  { id: 6n,  name: "Brent",     symbol: "BRNT", source: "pyth", pythFeed: "27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a", expo: -8 },
  { id: 7n,  name: "Copper",    symbol: "XCU",  source: "tv",   tvTicker: "COMEX:HG1!",   expo: -8 },
  { id: 8n,  name: "NatGas",    symbol: "NG",   source: "tv",   tvTicker: "NYMEX:NG1!",   expo: -8 },
  { id: 9n,  name: "Wheat",     symbol: "WHT",  source: "tv",   tvTicker: "CBOT:ZW1!",    expo: -8, divisor: 100 }, // cents/bu → $/bu
  { id: 10n, name: "Aluminum",  symbol: "XAL",  source: "tv",   tvTicker: "COMEX:ALI1!",  expo: -8 },
  { id: 11n, name: "Nickel",    symbol: "NI",   source: "tv",   tvTicker: "LME:NI1!",     expo: -8 },
  { id: 12n, name: "Tin",       symbol: "SN",   source: "tv",   tvTicker: "LME:SN1!",     expo: -8 },
  { id: 13n, name: "Coffee",    symbol: "KC",   source: "tv",   tvTicker: "ICEUS:KC1!",   expo: -8, divisor: 100 }, // cents/lb → $/lb
  { id: 14n, name: "Cocoa",     symbol: "CC",   source: "tv",   tvTicker: "ICEUS:CC1!",   expo: -8 },
];

// MockPyth ABI
const MOCK_PYTH_ABI = [
  {
    name: "updatePriceFeeds",
    type: "function",
    inputs: [{ name: "updateData", type: "bytes[]" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "createPriceFeedUpdateData",
    type: "function",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "price", type: "int64" },
      { name: "conf", type: "uint64" },
      { name: "expo", type: "int32" },
      { name: "emaPrice", type: "int64" },
      { name: "emaConf", type: "uint64" },
      { name: "publishTime", type: "uint64" },
    ],
    outputs: [{ name: "priceFeedData", type: "bytes" }],
    stateMutability: "pure",
  },
];

// ---- Fetch prices from Pyth Hermes ----
async function fetchPythPrices() {
  const pythFeeds = FEEDS.filter(f => f.source === "pyth");
  const ids = pythFeeds.map(f => f.pythFeed);
  const params = ids.map(id => `ids[]=${id}`).join("&");

  const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${params}`);
  const data = await res.json();

  const prices = {};
  for (const parsed of data.parsed || []) {
    const feed = pythFeeds.find(f => f.pythFeed === parsed.id);
    if (feed && parsed.price) {
      const price = Number(parsed.price.price) * Math.pow(10, Number(parsed.price.expo));
      if (price > 0) {
        prices[feed.symbol] = {
          price: BigInt(parsed.price.price),
          conf: BigInt(parsed.price.conf),
          expo: Number(parsed.price.expo),
        };
      }
    }
  }
  return prices;
}

// ---- Fetch prices from TradingView ----
async function fetchTVPrices() {
  const tvFeeds = FEEDS.filter(f => f.source === "tv");
  const tickers = tvFeeds.map(f => f.tvTicker);

  const res = await fetch("https://scanner.tradingview.com/futures/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columns: ["close"], symbols: { tickers } }),
  });
  const data = await res.json();

  const prices = {};
  for (const item of data.data || []) {
    const feed = tvFeeds.find(f => f.tvTicker === item.s);
    if (feed && item.d[0] > 0) {
      let rawPrice = item.d[0];
      if (feed.divisor) rawPrice = rawPrice / feed.divisor;
      // Convert to int with 8 decimal places (expo = -8)
      const priceInt = BigInt(Math.round(rawPrice * 1e8));
      prices[feed.symbol] = {
        price: priceInt,
        conf: priceInt / 200n, // 0.5% confidence
        expo: -8,
      };
    }
  }
  return prices;
}

// ---- Push prices to MockPyth ----
async function pushPrices(allPrices) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const updateDataArray = [];

  for (const feed of FEEDS) {
    const priceData = allPrices[feed.symbol];
    if (!priceData) continue;

    const feedId = "0x" + feed.id.toString(16).padStart(64, "0");

    // Create price feed update data via MockPyth contract
    const encoded = await publicClient.readContract({
      address: MOCK_PYTH,
      abi: MOCK_PYTH_ABI,
      functionName: "createPriceFeedUpdateData",
      args: [
        feedId,
        priceData.price,
        priceData.conf,
        priceData.expo,
        priceData.price,  // emaPrice
        priceData.conf,   // emaConf
        now,
      ],
    });

    updateDataArray.push(encoded);
  }

  if (updateDataArray.length === 0) {
    console.log("  No prices to push");
    return;
  }

  const hash = await walletClient.writeContract({
    address: MOCK_PYTH,
    abi: MOCK_PYTH_ABI,
    functionName: "updatePriceFeeds",
    args: [updateDataArray],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// ---- Main loop ----
async function poll() {
  const startTime = Date.now();

  try {
    // Fetch from both sources in parallel
    const [pythPrices, tvPrices] = await Promise.all([
      fetchPythPrices().catch(err => { console.error("  Pyth fetch error:", err.message); return {}; }),
      fetchTVPrices().catch(err => { console.error("  TV fetch error:", err.message); return {}; }),
    ]);

    const allPrices = { ...pythPrices, ...tvPrices };
    const count = Object.keys(allPrices).length;

    // Log prices
    console.log(`\n┌─────────────────────────────────────────┐`);
    console.log(`│  TerraVault Relayer — ${new Date().toISOString().slice(11, 19)} UTC  │`);
    console.log(`├──────────┬──────────────┬────────────────┤`);
    console.log(`│ Symbol   │ Price        │ Source         │`);
    console.log(`├──────────┼──────────────┼────────────────┤`);
    for (const feed of FEEDS) {
      const p = allPrices[feed.symbol];
      if (p) {
        const price = Number(p.price) * Math.pow(10, p.expo);
        const src = feed.source === "pyth" ? "Pyth Hermes" : "TradingView";
        console.log(`│ ${feed.symbol.padEnd(8)} │ $${price.toFixed(2).padStart(11)} │ ${src.padEnd(14)} │`);
      } else {
        console.log(`│ ${feed.symbol.padEnd(8)} │ ${"—".padStart(12)} │ ${"UNAVAILABLE".padEnd(14)} │`);
      }
    }
    console.log(`└──────────┴──────────────┴────────────────┘`);

    // Push to chain
    const hash = await pushPrices(allPrices);
    const elapsed = Date.now() - startTime;
    console.log(`  Pushed ${count}/14 prices in ${elapsed}ms | tx: ${hash?.slice(0, 10)}...`);

  } catch (err) {
    console.error("  Poll error:", err.message);
  }
}

// ---- Start ----
console.log(`
╔═══════════════════════════════════════════════╗
║  TerraVault Price Relayer                      ║
╠═══════════════════════════════════════════════╣
║  MockPyth:  ${MOCK_PYTH.slice(0, 10)}...${MOCK_PYTH.slice(-8)}       ║
║  Sources:   Pyth Hermes + TradingView          ║
║  Feeds:     14 commodities                      ║
║  Interval:  ${(POLL_INTERVAL / 1000)}s                                ║
╚═══════════════════════════════════════════════╝
`);

await poll();
setInterval(poll, POLL_INTERVAL);
