"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { Header } from "@/components/Header";
import { TradeModal } from "@/components/TradeModal";
import { usePythPrices, formatPrice } from "@/hooks/usePythPrices";
import { COMMODITIES, CONTRACTS, ASSET_IDS, type CommodityInfo } from "@/lib/config";
import Link from "next/link";

const TOKEN_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const VAULT_ABI = [
  {
    name: "getAsset",
    type: "function",
    inputs: [{ name: "assetId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "pythFeedId", type: "bytes32" },
          { name: "token", type: "address" },
          { name: "symbol", type: "string" },
          { name: "name", type: "string" },
          { name: "category", type: "uint8" },
          { name: "active", type: "bool" },
          { name: "totalMinted", type: "uint256" },
          { name: "totalReserve", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  precious: "var(--cat-precious)",
  energy: "var(--cat-energy)",
  industrial: "var(--cat-industrial)",
  agriculture: "var(--cat-agriculture)",
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { prices } = usePythPrices();
  const [sellCommodity, setSellCommodity] = useState<CommodityInfo | null>(null);

  const hasVault = CONTRACTS.VAULT.length > 2;

  const assetQueries = useReadContracts({
    contracts: hasVault
      ? COMMODITIES.map((c) => ({
          address: CONTRACTS.VAULT,
          abi: VAULT_ABI,
          functionName: "getAsset" as const,
          args: [ASSET_IDS[c.id]],
        }))
      : [],
  });

  const tokenAddresses: Record<string, `0x${string}`> = {};
  if (assetQueries.data) {
    assetQueries.data.forEach((result, i) => {
      if (result.status === "success" && result.result) {
        const asset = result.result as unknown as { token: `0x${string}` };
        tokenAddresses[COMMODITIES[i].id] = asset.token;
      }
    });
  }

  const balanceQueries = useReadContracts({
    contracts:
      Object.keys(tokenAddresses).length > 0 && address
        ? COMMODITIES.map((c) => ({
            address:
              tokenAddresses[c.id] ||
              ("0x0000000000000000000000000000000000000000" as `0x${string}`),
            abi: TOKEN_ABI,
            functionName: "balanceOf" as const,
            args: [address],
          }))
        : [],
  });

  const holdings = COMMODITIES.map((commodity, i) => {
    const balance =
      balanceQueries.data?.[i]?.status === "success"
        ? (balanceQueries.data[i].result as bigint)
        : BigInt(0);
    const price = prices[commodity.id];
    const balanceNum = parseFloat(formatUnits(balance, 18));
    const value = price ? balanceNum * price.price : 0;

    return { commodity, balance, balanceNum, value, price };
  }).filter((h) => h.balanceNum > 0.0001);

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  return (
    <>
      <Header />
      <main className="portfolio" style={{ paddingTop: "120px" }}>
        <div className="section-header">
          <div className="section-eyebrow">Your Portfolio</div>
          <h2 className="section-title">Holdings</h2>
        </div>

        {!isConnected ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="var(--text-muted)" fill="none" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="empty-state-title">Connect your wallet</div>
            <div className="empty-state-text">
              Connect a wallet to view your commodity holdings.
            </div>
          </div>
        ) : holdings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="var(--text-muted)" fill="none" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="empty-state-title">No holdings yet</div>
            <div className="empty-state-text">
              Buy commodities from the marketplace to build your portfolio.
            </div>
            <Link href="/" className="empty-state-btn">
              Browse Markets
            </Link>
          </div>
        ) : (
          <>
            {/* Portfolio Summary Cards */}
            <div className="portfolio-summary">
              <div className="portfolio-stat-card">
                <div className="portfolio-stat-label">Total Value</div>
                <div className="portfolio-stat-value">{formatPrice(totalValue)}</div>
              </div>
              <div className="portfolio-stat-card">
                <div className="portfolio-stat-label">Positions</div>
                <div className="portfolio-stat-value">{holdings.length}</div>
              </div>
              <div className="portfolio-stat-card">
                <div className="portfolio-stat-label">P&L</div>
                <div className="portfolio-stat-value" style={{ color: "var(--cat-agriculture)" }}>
                  --
                </div>
              </div>
            </div>

            {/* Holdings Table */}
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="hide-mobile">Balance</th>
                  <th className="hide-mobile">Price</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.commodity.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span
                          className="holding-category-dot"
                          style={{
                            background: CATEGORY_COLORS[h.commodity.category] || "var(--text-muted)",
                          }}
                        />
                        <div>
                          <div className="holding-name">{h.commodity.name}</div>
                          <div className="holding-secondary">tv{h.commodity.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-mobile">
                      {h.balanceNum.toFixed(4)} {h.commodity.unit}
                    </td>
                    <td className="hide-mobile">
                      {h.price ? formatPrice(h.price.price) : "..."}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(h.value)}</td>
                    <td>
                      <button
                        className="sell-btn"
                        onClick={() => setSellCommodity(h.commodity)}
                        type="button"
                      >
                        Sell
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-logo">TerraVault</div>
        <div className="footer-links">
          <a href="#">Docs</a>
          <a href="#">Governance</a>
        </div>
        <div className="footer-chain">
          <span className="chain-dot" />
          BNB Chain
        </div>
      </footer>

      {sellCommodity && (
        <TradeModal
          commodity={sellCommodity}
          price={prices[sellCommodity.id] || null}
          mode="sell"
          onClose={() => {
            setSellCommodity(null);
            balanceQueries.refetch();
          }}
          onTradeComplete={() => balanceQueries.refetch()}
          tokenBalance={holdings.find((h) => h.commodity.id === sellCommodity.id)?.balance}
        />
      )}
    </>
  );
}
