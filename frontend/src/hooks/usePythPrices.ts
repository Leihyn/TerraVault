"use client";

import { useEffect, useState } from "react";
import { COMMODITIES } from "@/lib/config";

export interface PriceData {
  price: number;
  conf: number;
  expo: number;
  publishTime: number;
}

export type PriceMap = Record<string, PriceData | null>;

const HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";

// Pyth feed IDs for assets with live Hermes data
const PYTH_FEEDS: Record<string, string> = {
  GOLD: "765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  SILVER: "f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  PLATINUM: "398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5",
  PALLADIUM: "80367e9664197f37d89a07a804dffd2101c479c7c4e8490501bc9d9e1e7f9021",
  OIL: "925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6",
  BRENT: "27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a",
};

// TradingView tickers for assets without Pyth Hermes data
const TV_FEEDS: Record<string, { ticker: string; divisor?: number }> = {
  COPPER: { ticker: "COMEX:HG1!" },
  NATGAS: { ticker: "NYMEX:NG1!" },
  WHEAT: { ticker: "CBOT:ZW1!", divisor: 100 },
  ALUMINUM: { ticker: "COMEX:ALI1!" },
  NICKEL: { ticker: "LME:NI1!" },
  TIN: { ticker: "LME:SN1!" },
  COFFEE: { ticker: "ICEUS:KC1!", divisor: 100 },
  COCOA: { ticker: "ICEUS:CC1!" },
};

async function fetchPythHermes(): Promise<PriceMap> {
  const ids = Object.values(PYTH_FEEDS);
  const params = ids.map((id) => `ids[]=${id}`).join("&");
  const res = await fetch(`${HERMES_URL}?${params}`);
  const data = await res.json();

  const prices: PriceMap = {};
  for (const parsed of data.parsed || []) {
    const entry = Object.entries(PYTH_FEEDS).find(
      ([, feed]) => feed === parsed.id
    );
    if (entry && parsed.price) {
      const p = parsed.price;
      const priceValue = Number(p.price) * Math.pow(10, Number(p.expo));
      if (priceValue > 0) {
        prices[entry[0]] = {
          price: priceValue,
          conf: Number(p.conf) * Math.pow(10, Number(p.expo)),
          expo: Number(p.expo),
          publishTime: Number(p.publish_time),
        };
      }
    }
  }
  return prices;
}

async function fetchTradingView(): Promise<PriceMap> {
  // Fetch via API proxy to avoid browser CORS issues
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
  const res = await fetch(`${API_URL}/api/tv-prices`);
  const data = await res.json();

  const prices: PriceMap = {};
  for (const item of data.data || []) {
    const entry = Object.entries(TV_FEEDS).find(([, f]) => f.ticker === item.s);
    if (entry && item.d[0] > 0) {
      let rawPrice = item.d[0];
      if (entry[1].divisor) rawPrice = rawPrice / entry[1].divisor;
      prices[entry[0]] = {
        price: rawPrice,
        conf: rawPrice * 0.005,
        expo: 0,
        publishTime: Math.floor(Date.now() / 1000),
      };
    }
  }
  return prices;
}

export function usePythPrices(intervalMs = 10000) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const [pythPrices, tvPrices] = await Promise.all([
          fetchPythHermes().catch(() => ({} as PriceMap)),
          fetchTradingView().catch(() => ({} as PriceMap)),
        ]);

        setPrices({ ...pythPrices, ...tvPrices });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch prices:", err);
        setLoading(false);
      }
    }

    fetchPrices();
    const interval = setInterval(fetchPrices, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return { prices, loading };
}

export function formatPrice(price: number): string {
  if (price >= 1000)
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}
