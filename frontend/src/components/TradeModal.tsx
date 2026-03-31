"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits, encodeFunctionData } from "viem";
import type { CommodityInfo } from "@/lib/config";
import { CONTRACTS, ASSET_IDS } from "@/lib/config";
import type { PriceData } from "@/hooks/usePythPrices";
import { formatPrice } from "@/hooks/usePythPrices";

const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const VAULT_ABI = [
  {
    name: "buy",
    type: "function",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "usdcAmount", type: "uint256" },
      { name: "pythUpdateData", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "sell",
    type: "function",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "tokenAmount", type: "uint256" },
      { name: "pythUpdateData", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

interface Props {
  commodity: CommodityInfo;
  price: PriceData | null;
  mode: "buy" | "sell";
  onClose: () => void;
  onTradeComplete?: () => void;
  tokenBalance?: bigint;
}

const QUICK_AMOUNTS = [
  { label: "$100", value: "100" },
  { label: "$500", value: "500" },
  { label: "$1K", value: "1000" },
  { label: "$5K", value: "5000" },
];

export function TradeModal({ commodity, price, mode: initialMode, onClose, onTradeComplete, tokenBalance }: Props) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"buy" | "sell">(initialMode);
  const [step, setStep] = useState<"input" | "approving" | "trading" | "done" | "error">("input");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sellPct, setSellPct] = useState(100);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const assetId = ASSET_IDS[commodity.id];
  const numericAmount = parseFloat(amount) || 0;

  let expectedOutput = 0;
  let fee = 0;
  if (price && numericAmount > 0) {
    if (mode === "buy") {
      fee = numericAmount * 0.002;
      expectedOutput = (numericAmount - fee) / price.price;
    } else {
      const grossValue = numericAmount * price.price;
      fee = grossValue * 0.001;
      expectedOutput = grossValue - fee;
    }
  }

  async function handleTrade() {
    if (!address || !assetId || !walletClient || !publicClient) return;

    try {
      if (mode === "buy") {
        const usdcAmount = parseUnits(amount, 6);

        // Step 1: Approve
        setStep("approving");
        const approveHash = await walletClient.writeContract({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: "approve",
          args: [CONTRACTS.VAULT, usdcAmount],
        });

        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        // Step 2: Buy
        setStep("trading");

        // Fetch Pyth update data
        const pythData = await fetchPythUpdateData(commodity.pythFeedId);

        const buyHash = await walletClient.writeContract({
          address: CONTRACTS.VAULT,
          abi: VAULT_ABI,
          functionName: "buy",
          args: [assetId, usdcAmount, pythData],
          value: BigInt(0),
        });

        await publicClient.waitForTransactionReceipt({ hash: buyHash });
        setTxHash(buyHash);
        setStep("done");
        onTradeComplete?.();

      } else {
        const tokenAmount = parseUnits(amount, 18);
        setStep("trading");

        const pythData = await fetchPythUpdateData(commodity.pythFeedId);

        const sellHash = await walletClient.writeContract({
          address: CONTRACTS.VAULT,
          abi: VAULT_ABI,
          functionName: "sell",
          args: [assetId, tokenAmount, pythData],
          value: BigInt(1),
        });

        await publicClient.waitForTransactionReceipt({ hash: sellHash });
        setTxHash(sellHash);
        setStep("done");
        onTradeComplete?.();
      }
    } catch (err: any) {
      console.error("Trade failed:", err);
      setErrorMsg(err.shortMessage || err.message || "Transaction failed");
      setStep("error");
    }
  }

  const txHashDisplay = txHash
    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
    : "";

  return (
    <div className="trade-overlay" onClick={onClose}>
      <div className="trade-panel" onClick={(e) => e.stopPropagation()}>
        <div className="trade-handle" />

        {step === "done" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div className="confirm-check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="confirm-title">Trade Confirmed</div>
            <div className="confirm-subtitle">
              {mode === "buy"
                ? `You purchased ~${expectedOutput.toFixed(4)} ${commodity.unit} of ${commodity.name}`
                : `You received ~${formatPrice(expectedOutput)} USDC`}
            </div>
            {txHashDisplay && (
              <div className="confirm-tx">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>{txHashDisplay}</span>
              </div>
            )}
            <div className="confirm-attestation">
              On-chain attestation recorded on BNB Chain.
            </div>
            <button className="confirm-done-btn" onClick={onClose} type="button">
              Done
            </button>
          </div>
        ) : step === "error" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div className="confirm-check" style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="confirm-title">Trade Failed</div>
            <div className="confirm-subtitle" style={{ color: "var(--text-muted)" }}>
              {errorMsg}
            </div>
            <button className="confirm-done-btn" onClick={() => { setStep("input"); setErrorMsg(""); }} type="button" style={{ marginTop: "16px" }}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="trade-header">
              <div className="trade-commodity-info">
                <div className="trade-commodity-icon">
                  {commodity.symbol}
                </div>
                <div>
                  <div className="trade-commodity-name">{commodity.name}</div>
                  <div className="trade-commodity-price">
                    {price ? `${formatPrice(price.price)} / ${commodity.unit}` : "..."}
                  </div>
                </div>
              </div>
              <button className="trade-close" onClick={onClose} aria-label="Close trade panel" type="button">
                &times;
              </button>
            </div>

            <div className="trade-type-toggle">
              <button
                className={`trade-type-btn${mode === "buy" ? " active" : ""}`}
                onClick={() => { setMode("buy"); setAmount(""); }}
                type="button"
                disabled={step !== "input"}
              >
                Buy
              </button>
              <button
                className={`trade-type-btn${mode === "sell" ? " active" : ""}`}
                onClick={() => { setMode("sell"); setAmount(""); }}
                type="button"
                disabled={step !== "input"}
              >
                Sell
              </button>
            </div>

            <div className="trade-amount-group">
              <div className="trade-label">Amount</div>
              <div className="trade-amount-input-wrap">
                <span className="trade-currency-prefix">
                  {mode === "buy" ? "$" : ""}
                </span>
                <input
                  type="number"
                  className="trade-amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={step !== "input"}
                />
                <span className="trade-amount-unit">
                  {mode === "buy" ? "USDC" : `tv${commodity.symbol}`}
                </span>
              </div>

              {mode === "buy" && (
                <div className="trade-quick-amounts">
                  {QUICK_AMOUNTS.map((qa) => (
                    <button
                      key={qa.value}
                      className="quick-amt"
                      onClick={() => setAmount(qa.value)}
                      type="button"
                      disabled={step !== "input"}
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              )}

              {mode === "sell" && tokenBalance !== undefined && tokenBalance > 0n && (
                <div className="sell-pct-controls">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={sellPct}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      setSellPct(pct);
                      const bal = parseFloat(formatUnits(tokenBalance, 18));
                      setAmount(pct === 100 ? formatUnits(tokenBalance, 18) : (bal * pct / 100).toFixed(8));
                    }}
                    className="sell-slider"
                    disabled={step !== "input"}
                  />
                  <div className="sell-pct-buttons">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        className={`quick-amt${sellPct === pct ? " active" : ""}`}
                        onClick={() => {
                          setSellPct(pct);
                          const bal = parseFloat(formatUnits(tokenBalance, 18));
                          setAmount(pct === 100 ? formatUnits(tokenBalance, 18) : (bal * pct / 100).toFixed(8));
                        }}
                        type="button"
                        disabled={step !== "input"}
                      >
                        {pct === 100 ? "Max" : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {numericAmount > 0 && price && (
              <div className="trade-fees">
                <div className="trade-fee-row">
                  <span className="trade-fee-label">Quantity</span>
                  <span className="trade-fee-value tabular">
                    {mode === "buy"
                      ? `${expectedOutput.toFixed(4)} ${commodity.unit}`
                      : `${numericAmount.toFixed(4)} tv${commodity.symbol}`}
                  </span>
                </div>
                <div className="trade-fee-row">
                  <span className="trade-fee-label">Network fee</span>
                  <span className="trade-fee-value tabular">$0.12</span>
                </div>
                <div className="trade-fee-row">
                  <span className="trade-fee-label">
                    Protocol fee ({mode === "buy" ? "0.2%" : "0.1%"})
                  </span>
                  <span className="trade-fee-value tabular">
                    {formatPrice(fee)}
                  </span>
                </div>
                <div className="trade-fee-row total">
                  <span className="trade-fee-label">Total</span>
                  <span className="trade-fee-value tabular">
                    {mode === "buy"
                      ? `${formatPrice(numericAmount)}`
                      : `~${formatPrice(expectedOutput)} USDC`}
                  </span>
                </div>
              </div>
            )}

            <button
              className="trade-confirm"
              onClick={handleTrade}
              disabled={step !== "input" || numericAmount <= 0 || !price}
              type="button"
            >
              {step === "approving"
                ? "Approving USDC..."
                : step === "trading"
                  ? "Confirming Trade..."
                  : numericAmount <= 0
                    ? "Enter an amount"
                    : mode === "buy"
                      ? `Buy ${commodity.symbol}`
                      : `Sell ${commodity.symbol}`}
            </button>

            <div className="trade-chain-note">
              <span className="chain-dot" />
              Settled on BNB Chain with on-chain attestation
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Prices are already pushed to MockPyth by the relayer.
// No need to fetch update data. Pass empty array.
async function fetchPythUpdateData(_feedId: string): Promise<`0x${string}`[]> {
  return [];
}
