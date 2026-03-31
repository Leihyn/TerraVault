"use client";

import { useMemo } from "react";
import type { CommodityInfo } from "@/lib/config";
import type { PriceData } from "@/hooks/usePythPrices";
import { formatPrice } from "@/hooks/usePythPrices";

const CATEGORY_COLORS: Record<string, string> = {
  precious: "var(--cat-precious)",
  energy: "var(--cat-energy)",
  industrial: "var(--cat-industrial)",
  agriculture: "var(--cat-agriculture)",
};

const CATEGORY_LABELS: Record<string, string> = {
  precious: "Precious Metal",
  energy: "Energy",
  industrial: "Industrial",
  agriculture: "Agriculture",
};

// Featured commodities that span 2 columns on desktop
const FEATURED_IDS = new Set(["GOLD", "OIL"]);

interface Props {
  commodity: CommodityInfo;
  price: PriceData | null;
  onBuy: (commodity: CommodityInfo) => void;
}

export function CommodityCard({ commodity, price, onBuy }: Props) {
  const accentColor = CATEGORY_COLORS[commodity.category] || "var(--text-muted)";
  const isFeatured = FEATURED_IDS.has(commodity.id);

  // Generate a stable pseudo-random change percentage for demo
  const change = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < commodity.id.length; i++) {
      hash = (hash * 31 + commodity.id.charCodeAt(i)) | 0;
    }
    const val = ((hash % 50) - 15) / 10;
    return val;
  }, [commodity.id]);

  const isUp = change >= 0;
  const changeStr = `${isUp ? "+" : ""}${change.toFixed(1)}%`;

  const marketClosed = !price;

  return (
    <div
      className={`commodity-card${isFeatured ? " featured" : ""}${marketClosed ? " market-closed" : ""}`}
      style={{ "--card-accent": accentColor } as React.CSSProperties}
    >
      <div className="card-top">
        <div
          className="card-symbol"
          style={{
            border: `1px solid ${accentColor}33`,
            color: marketClosed ? "var(--text-muted)" : accentColor,
          }}
        >
          {commodity.symbol}
        </div>
        {marketClosed ? (
          <span className="card-change closed">Closed</span>
        ) : (
          <span className={`card-change tabular ${isUp ? "up" : "down"}`}>
            {changeStr}
          </span>
        )}
      </div>
      <div className="card-name">{commodity.name}</div>
      <div className="card-category">{CATEGORY_LABELS[commodity.category]}</div>
      <div className="card-price-row">
        {marketClosed ? (
          <span className="card-price" style={{ color: "var(--text-muted)", fontSize: "16px" }}>
            Market Closed
          </span>
        ) : (
          <>
            <span className="card-price tabular">{formatPrice(price.price)}</span>
            <span className="card-unit">/ {commodity.unit}</span>
          </>
        )}
      </div>
      <button
        className="card-buy"
        onClick={(e) => {
          e.stopPropagation();
          onBuy(commodity);
        }}
        disabled={marketClosed}
      >
        {marketClosed ? "Unavailable" : `Trade ${commodity.symbol}`}
      </button>
    </div>
  );
}
