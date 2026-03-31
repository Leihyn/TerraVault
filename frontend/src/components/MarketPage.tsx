"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { CommodityCard } from "@/components/CommodityCard";
import { TradeModal } from "@/components/TradeModal";
import { usePythPrices } from "@/hooks/usePythPrices";
import { COMMODITIES, CATEGORY_LABELS, type CommodityInfo } from "@/lib/config";

type CategoryFilter = "all" | "precious" | "energy" | "industrial" | "agriculture";

const FILTER_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "precious", label: "Precious Metals" },
  { value: "energy", label: "Energy" },
  { value: "industrial", label: "Industrial" },
  { value: "agriculture", label: "Agriculture" },
];

export default function MarketPage() {
  const { prices, loading } = usePythPrices();
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityInfo | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const heroRef = useRef<HTMLElement>(null);

  // Parallax fade on hero scroll
  useEffect(() => {
    function handleScroll() {
      if (!heroRef.current) return;
      const scrollY = window.scrollY;
      const heroHeight = heroRef.current.offsetHeight;
      const opacity = Math.max(0, 1 - scrollY / (heroHeight * 0.7));
      heroRef.current.style.opacity = String(opacity);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredCommodities =
    filter === "all"
      ? COMMODITIES
      : COMMODITIES.filter((c) => c.category === filter);

  return (
    <>
      <Header />

      {/* Hero Section */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg" />

        {/* Cosmic globe visual */}
        <div className="hero-orb-container">
          <div className="hero-orb">
            <div className="hero-latitude" />
            <div className="hero-latitude" />
            <div className="hero-latitude" />
            <div className="hero-latitude" />
            <div className="hero-meridian" />
            <div className="hero-meridian" />
            <div className="hero-meridian" />
          </div>
          <div className="hero-ring" />
          <div className="hero-ring" />
          <div className="hero-ring" />
          <div className="hero-particle" />
          <div className="hero-particle" />
          <div className="hero-particle" />
        </div>

        {/* Hero Content */}
        <div className="hero-content">
          <div className="hero-eyebrow">On-Chain Commodities</div>
          <h1 className="hero-title">TerraVault</h1>
          <p className="hero-subtitle">
            Commodity markets for the world. Not just Wall Street.
          </p>
          <div className="hero-stats">
            <div>
              <div className="hero-stat-value tabular">
                {COMMODITIES.length}
              </div>
              <div className="hero-stat-label">Assets</div>
            </div>
            <div>
              <div className="hero-stat-value tabular">4</div>
              <div className="hero-stat-label">Categories</div>
            </div>
            <div>
              <div className="hero-stat-value tabular">Pyth</div>
              <div className="hero-stat-label">Oracle</div>
            </div>
            <div>
              <div className="hero-stat-value tabular">BNB</div>
              <div className="hero-stat-label">Chain</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="scroll-indicator">
          <span>Explore Markets</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* Marketplace Section */}
      <section className="marketplace" id="marketplace">
        <div className="section-header">
          <div className="section-eyebrow">Live Markets</div>
          <h2 className="section-title">Trade global commodities</h2>
          <p className="section-subtitle">
            Tokenized real-world assets settled on-chain. No minimums, no
            accreditation, no gatekeepers.
          </p>
        </div>

        {/* Category Filters */}
        <div className="category-filters">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`category-btn${filter === opt.value ? " active" : ""}`}
              onClick={() => setFilter(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Commodity Grid */}
        <div className="commodity-grid">
          {filteredCommodities.map((commodity) => (
            <CommodityCard
              key={commodity.id}
              commodity={commodity}
              price={prices[commodity.id] || null}
              onBuy={setSelectedCommodity}
            />
          ))}
        </div>

        {loading && filteredCommodities.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            Fetching live prices from Pyth Network...
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-logo">TerraVault</div>
        <div className="footer-links">
          <a href="#">Docs</a>
          <a href="#">Governance</a>
          <a href="#">Audit</a>
          <a href="#">GitHub</a>
        </div>
        <div className="footer-chain">
          <span className="chain-dot" />
          BNB Chain
        </div>
      </footer>

      {selectedCommodity && (
        <TradeModal
          commodity={selectedCommodity}
          price={prices[selectedCommodity.id] || null}
          mode="buy"
          onClose={() => setSelectedCommodity(null)}
        />
      )}
    </>
  );
}
