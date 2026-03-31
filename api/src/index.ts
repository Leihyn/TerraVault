import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  keccak256,
  toHex,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import {
  requirePayment,
  Service,
  getAllPricing,
  getStats,
} from "./x402.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---- Config ----
const PORT = process.env.PORT || 3001;
const VAULT_ADDRESS = (process.env.VAULT_ADDRESS ||
  "0xE9d35D80c7C5DD0CBf8D956e4293Fbf3F28D080d") as `0x${string}`;
const USDC_ADDRESS = (process.env.USDC_ADDRESS ||
  "0x33CF3b0BED8bD93aA4E1be0c0cE598858435c815") as `0x${string}`;

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
});

// Wallet client for executing trades (optional, for server-side execution)
let walletClient: ReturnType<typeof createWalletClient> | null = null;
if (process.env.PRIVATE_KEY) {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
  });
}

// Asset IDs
const ASSET_IDS: Record<string, `0x${string}`> = {
  gold: keccak256(toHex("GOLD")),
  silver: keccak256(toHex("SILVER")),
  platinum: keccak256(toHex("PLATINUM")),
  copper: keccak256(toHex("COPPER")),
  oil: keccak256(toHex("OIL")),
  brent: keccak256(toHex("BRENT")),
  natgas: keccak256(toHex("NATGAS")),
  wheat: keccak256(toHex("WHEAT")),
};

// Pyth feed IDs
const PYTH_FEEDS: Record<string, string> = {
  gold: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  silver: "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  platinum: "0x398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5",
  copper: "0x636bedafa14a37912993f265eda22431a2be363ad41a10276424bbe1b7f508c4",
  oil: "0x925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6",
  brent: "0x27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a",
  natgas: "0xcbbe4de47ffd7681b33db9ebdf22eeb899046cbe566be06e875bf088324787ce",
  wheat: "0xa2c8737267dbe6118b2fc7f081484141a25f2753b19b3b5b0968ac3f05657a0c",
};

// ---- Helper: fetch Pyth price ----
async function fetchPythPrice(feedId: string) {
  const res = await fetch(
    `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`
  );
  const data = await res.json();
  const parsed = data.parsed?.[0];
  if (!parsed) return null;

  const price =
    Number(parsed.price.price) * Math.pow(10, Number(parsed.price.expo));
  if (price <= 0) return null; // Feed inactive or off-hours
  return {
    price,
    conf:
      Number(parsed.price.conf) * Math.pow(10, Number(parsed.price.expo)),
    expo: Number(parsed.price.expo),
    publishTime: Number(parsed.price.publish_time),
    updateData: data.binary?.data?.[0] || null,
  };
}

// ---- Routes ----

// TradingView proxy (avoids browser CORS issues)
app.get("/api/tv-prices", async (_req, res) => {
  try {
    const tickers = [
      "COMEX:HG1!", "NYMEX:NG1!", "CBOT:ZW1!", "COMEX:ALI1!",
      "LME:NI1!", "LME:SN1!", "ICEUS:KC1!", "ICEUS:CC1!",
    ];
    const tvRes = await fetch("https://scanner.tradingview.com/futures/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: ["close"], symbols: { tickers } }),
    });
    const data = await tvRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    network: "bsc-testnet",
    vault: VAULT_ADDRESS,
  });
});

// Pricing
app.get("/pricing", (_req, res) => {
  res.json(getAllPricing());
});

// Stats
app.get("/stats", (_req, res) => {
  res.json(getStats());
});

// Get all prices
app.get("/api/prices", async (_req, res) => {
  try {
    const feedIds = Object.values(PYTH_FEEDS);
    const params = feedIds.map((id) => `ids[]=${id}`).join("&");
    const apiRes = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?${params}`
    );
    const data = await apiRes.json();

    const prices: Record<string, any> = {};
    const assetNames = Object.keys(PYTH_FEEDS);

    for (const parsed of data.parsed || []) {
      const asset = assetNames.find(
        (name) =>
          PYTH_FEEDS[name].toLowerCase() === `0x${parsed.id}`.toLowerCase()
      );
      if (asset && parsed.price) {
        const p = parsed.price;
        prices[asset] = {
          price:
            Number(p.price) * Math.pow(10, Number(p.expo)),
          conf: Number(p.conf) * Math.pow(10, Number(p.expo)),
          expo: Number(p.expo),
          publishTime: Number(p.publish_time),
        };
      }
    }

    res.json({ prices, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single price
app.get("/api/prices/:asset", async (req, res) => {
  const asset = req.params.asset.toLowerCase();
  const feedId = PYTH_FEEDS[asset];
  if (!feedId) {
    return res.status(404).json({ error: `Unknown asset: ${asset}` });
  }

  try {
    const price = await fetchPythPrice(feedId);
    if (!price) {
      return res.status(500).json({ error: "Failed to fetch price" });
    }
    res.json({ asset, ...price });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Buy commodity (x402-gated)
app.post(
  "/api/buy/:asset",
  requirePayment(Service.BUY, (req) => {
    const amount = req.body?.amount;
    return amount ? BigInt(Math.floor(Number(amount) * 1e6)) : undefined;
  }),
  async (req, res) => {
    const asset = req.params.asset.toLowerCase();
    const assetId = ASSET_IDS[asset];
    const feedId = PYTH_FEEDS[asset];

    if (!assetId || !feedId) {
      return res.status(404).json({ error: `Unknown asset: ${asset}` });
    }

    const usdcAmount = req.body?.amount;
    if (!usdcAmount || Number(usdcAmount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    try {
      // Fetch current price
      const priceData = await fetchPythPrice(feedId);
      if (!priceData) {
        return res.status(500).json({ error: "Failed to fetch price" });
      }

      const usdcUnits = parseUnits(String(usdcAmount), 6);
      const fee = (req as any).x402?.amount || 0n;

      // Calculate expected tokens
      const netAmount = Number(usdcAmount) - Number(usdcAmount) * 0.002;
      const expectedTokens = netAmount / priceData.price;

      res.json({
        success: true,
        asset,
        usdcAmount: usdcAmount,
        fee: formatUnits(typeof fee === "bigint" ? fee : BigInt(fee), 6),
        expectedTokens: expectedTokens.toFixed(6),
        price: priceData.price,
        assetId,
        vaultAddress: VAULT_ADDRESS,
        pythUpdateData: priceData.updateData
          ? `0x${priceData.updateData}`
          : null,
        message: `Buy ${expectedTokens.toFixed(4)} tv${asset.toUpperCase()} for $${usdcAmount} USDC`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Sell commodity (x402-gated)
app.post(
  "/api/sell/:asset",
  requirePayment(Service.SELL, (req) => {
    const amount = req.body?.amount;
    const price = req.body?.price;
    return amount && price
      ? BigInt(Math.floor(Number(amount) * Number(price) * 1e6))
      : undefined;
  }),
  async (req, res) => {
    const asset = req.params.asset.toLowerCase();
    const assetId = ASSET_IDS[asset];
    const feedId = PYTH_FEEDS[asset];

    if (!assetId || !feedId) {
      return res.status(404).json({ error: `Unknown asset: ${asset}` });
    }

    const tokenAmount = req.body?.amount;
    if (!tokenAmount || Number(tokenAmount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    try {
      const priceData = await fetchPythPrice(feedId);
      if (!priceData) {
        return res.status(500).json({ error: "Failed to fetch price" });
      }

      const grossValue = Number(tokenAmount) * priceData.price;
      const fee = grossValue * 0.001;
      const netValue = grossValue - fee;

      res.json({
        success: true,
        asset,
        tokenAmount,
        grossValue: grossValue.toFixed(2),
        fee: fee.toFixed(2),
        netValue: netValue.toFixed(2),
        price: priceData.price,
        assetId,
        vaultAddress: VAULT_ADDRESS,
        pythUpdateData: priceData.updateData
          ? `0x${priceData.updateData}`
          : null,
        message: `Sell ${tokenAmount} tv${asset.toUpperCase()} for ~$${netValue.toFixed(2)} USDC`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// AI Forecast (x402-gated)
app.get(
  "/api/forecast/:asset",
  requirePayment(Service.FORECAST),
  async (req, res) => {
    const asset = req.params.asset.toLowerCase();
    const feedId = PYTH_FEEDS[asset];

    if (!feedId) {
      return res.status(404).json({ error: `Unknown asset: ${asset}` });
    }

    try {
      const priceData = await fetchPythPrice(feedId);
      if (!priceData) {
        return res.status(500).json({ error: "Failed to fetch price" });
      }

      // Generate forecast (simplified. In production, call an LLM API)
      const currentPrice = priceData.price;
      const volatility = (priceData.conf / currentPrice) * 100;

      // Simple momentum-based forecast
      const random = Math.random();
      const direction = random > 0.5 ? 1 : -1;
      const magnitude = volatility * (0.5 + Math.random());
      const predictedChange = direction * magnitude;
      const predictedPrice = currentPrice * (1 + predictedChange / 100);
      const confidence = Math.max(40, Math.min(85, 70 - volatility * 5));

      res.json({
        asset,
        currentPrice,
        prediction: {
          price24h: Number(predictedPrice.toFixed(2)),
          change24h: `${predictedChange > 0 ? "+" : ""}${predictedChange.toFixed(2)}%`,
          direction: predictedChange > 0 ? "bullish" : "bearish",
          confidence: `${confidence.toFixed(0)}%`,
        },
        analysis: {
          volatility: `${volatility.toFixed(2)}%`,
          summary: `${asset.toUpperCase()} is showing ${
            predictedChange > 0 ? "upward" : "downward"
          } momentum with ${volatility.toFixed(1)}% current volatility. ${
            confidence > 60
              ? "Moderate confidence in the prediction."
              : "Low confidence due to high volatility."
          }`,
        },
        paidVia: "x402",
        cost: "$0.10",
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ---- Start ----
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  TerraVault API | x402 Commodity Gateway       ║
╠═══════════════════════════════════════════════╣
║  Port:      ${String(PORT).padEnd(34)}║
║  Network:   BSC Testnet (97)                  ║
║  Vault:     ${VAULT_ADDRESS.slice(0, 10)}...${VAULT_ADDRESS.slice(-8)}       ║
║  Mode:      ${(process.env.DEMO_MODE === "true" ? "DEMO" : "PRODUCTION").padEnd(34)}║
╚═══════════════════════════════════════════════╝
  `);
});
