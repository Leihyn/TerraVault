"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Link from "next/link";
import { CONTRACTS } from "@/lib/config";

const USDC_ABI = [
  {
    name: "faucet",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [minting, setMinting] = useState(false);
  const { address, isConnected } = useAccount();

  const { writeContract, data: mintTxHash } = useWriteContract();
  const { isSuccess: mintConfirmed } = useWaitForTransactionReceipt({ hash: mintTxHash });

  useEffect(() => {
    if (mintConfirmed) {
      setMinting(false);
    }
  }, [mintConfirmed]);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  function handleMintUSDC() {
    if (!CONTRACTS.USDC || CONTRACTS.USDC.length < 3) return;
    setMinting(true);
    writeContract({
      address: CONTRACTS.USDC,
      abi: USDC_ABI,
      functionName: "faucet",
    });
  }

  return (
    <>
      <header className={`topbar${scrolled ? " scrolled" : ""}`}>
        <Link href="/" className="topbar-logo">
          TerraVault
        </Link>
        <div className="topbar-actions">
          {isConnected && (
            <button
              className="btn-faucet"
              onClick={handleMintUSDC}
              disabled={minting}
              type="button"
            >
              {minting ? "Minting..." : mintConfirmed ? "10K USDC Minted" : "Mint 10K USDC"}
            </button>
          )}
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button
                  className={`btn-wallet${connected ? " connected" : ""}`}
                  onClick={connected ? openAccountModal : openConnectModal}
                  type="button"
                >
                  {connected
                    ? `${account.displayName}`
                    : "Connect Wallet"}
                </button>
              );
            }}
          </ConnectButton.Custom>
          <button
            className={`hamburger${navOpen ? " active" : ""}`}
            onClick={() => setNavOpen(!navOpen)}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <nav
        className={`nav-overlay${navOpen ? " open" : ""}`}
        aria-hidden={!navOpen}
      >
        <Link href="/" onClick={() => setNavOpen(false)}>
          Marketplace
        </Link>
        <Link href="/portfolio" onClick={() => setNavOpen(false)}>
          Portfolio
        </Link>
        <div className="nav-footer">Secured on BNB Chain</div>
      </nav>
    </>
  );
}
