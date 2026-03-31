import { http } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { keccak256, toHex } from "viem";

export const config = getDefaultConfig({
  appName: "TerraVault",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
  },
});

// Contract addresses. Update after deployment.
export const CONTRACTS = {
  USDC: (process.env.NEXT_PUBLIC_USDC_ADDRESS || "") as `0x${string}`,
  VAULT: (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`,
} as const;

// Asset IDs: keccak256 of the string name (matches Solidity deploy script)
export const ASSET_IDS: Record<string, `0x${string}`> = {
  GOLD: keccak256(toHex("GOLD")),
  SILVER: keccak256(toHex("SILVER")),
  PLATINUM: keccak256(toHex("PLATINUM")),
  PALLADIUM: keccak256(toHex("PALLADIUM")),
  COPPER: keccak256(toHex("COPPER")),
  OIL: keccak256(toHex("OIL")),
  BRENT: keccak256(toHex("BRENT")),
  NATGAS: keccak256(toHex("NATGAS")),
  WHEAT: keccak256(toHex("WHEAT")),
  ALUMINUM: keccak256(toHex("ALUMINUM")),
  NICKEL: keccak256(toHex("NICKEL")),
  TIN: keccak256(toHex("TIN")),
  COFFEE: keccak256(toHex("COFFEE")),
  COCOA: keccak256(toHex("COCOA")),
};

// Commodity metadata
export interface CommodityInfo {
  id: string;
  symbol: string;
  name: string;
  category: "precious" | "energy" | "industrial" | "agriculture";
  unit: string;
  pythFeedId: string;
}

export const COMMODITIES: CommodityInfo[] = [
  // Precious Metals
  { id: "GOLD", symbol: "XAU", name: "Gold", category: "precious", unit: "oz", pythFeedId: "1" },
  { id: "SILVER", symbol: "XAG", name: "Silver", category: "precious", unit: "oz", pythFeedId: "2" },
  { id: "PLATINUM", symbol: "XPT", name: "Platinum", category: "precious", unit: "oz", pythFeedId: "3" },
  { id: "PALLADIUM", symbol: "XPD", name: "Palladium", category: "precious", unit: "oz", pythFeedId: "4" },
  // Energy
  { id: "OIL", symbol: "WTI", name: "Crude Oil", category: "energy", unit: "bbl", pythFeedId: "5" },
  { id: "BRENT", symbol: "BRNT", name: "Brent Crude", category: "energy", unit: "bbl", pythFeedId: "6" },
  { id: "NATGAS", symbol: "NG", name: "Natural Gas", category: "energy", unit: "MMBtu", pythFeedId: "8" },
  // Industrial Metals
  { id: "COPPER", symbol: "XCU", name: "Copper", category: "industrial", unit: "lb", pythFeedId: "7" },
  { id: "ALUMINUM", symbol: "XAL", name: "Aluminum", category: "industrial", unit: "ton", pythFeedId: "10" },
  { id: "NICKEL", symbol: "NI", name: "Nickel", category: "industrial", unit: "ton", pythFeedId: "11" },
  { id: "TIN", symbol: "SN", name: "Tin", category: "industrial", unit: "ton", pythFeedId: "12" },
  // Agriculture
  { id: "WHEAT", symbol: "WHT", name: "Wheat", category: "agriculture", unit: "bu", pythFeedId: "9" },
  { id: "COFFEE", symbol: "KC", name: "Coffee", category: "agriculture", unit: "lb", pythFeedId: "13" },
  { id: "COCOA", symbol: "CC", name: "Cocoa", category: "agriculture", unit: "ton", pythFeedId: "14" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  precious: "Precious Metals",
  energy: "Energy",
  industrial: "Industrial Metals",
  agriculture: "Agriculture",
};
