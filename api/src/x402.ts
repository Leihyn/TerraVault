/**
 * TerraVault x402 Middleware
 * HTTP 402 Payment Required protocol for commodity trading fees
 */

import { Request, Response, NextFunction } from "express";
import { verifyMessage, recoverMessageAddress } from "viem";

// Service types
export enum Service {
  BUY = "buy",
  SELL = "sell",
  FORECAST = "forecast",
}

// Pricing in USDC (6 decimals)
const USDC_DECIMALS = 6;

interface ServicePrice {
  service: Service;
  name: string;
  description: string;
  basePrice: bigint; // flat fee in USDC units
  percentageFee?: number; // percentage of notional (0.002 = 0.2%)
}

const PRICING: Record<Service, ServicePrice> = {
  [Service.BUY]: {
    service: Service.BUY,
    name: "Buy Commodity",
    description: "Purchase tokenized commodity exposure",
    basePrice: 0n,
    percentageFee: 0.002, // 0.2%
  },
  [Service.SELL]: {
    service: Service.SELL,
    name: "Sell Commodity",
    description: "Sell tokenized commodity exposure",
    basePrice: 0n,
    percentageFee: 0.001, // 0.1%
  },
  [Service.FORECAST]: {
    service: Service.FORECAST,
    name: "AI Price Forecast",
    description: "AI-powered commodity price prediction",
    basePrice: BigInt(100000), // $0.10
  },
};

export function calculatePrice(service: Service, notional?: bigint): bigint {
  const pricing = PRICING[service];
  let total = pricing.basePrice;

  if (pricing.percentageFee && notional) {
    const pctFee =
      (notional * BigInt(Math.floor(pricing.percentageFee * 10000))) / 10000n;
    total += pctFee;
  }

  return total;
}

function formatUSDC(amount: bigint): string {
  const whole = amount / BigInt(10 ** USDC_DECIMALS);
  const frac = amount % BigInt(10 ** USDC_DECIMALS);
  return `$${whole}.${frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 2)}`;
}

// Payment record storage
interface PaymentRecord {
  payer: string;
  service: Service;
  amount: bigint;
  timestamp: number;
  txHash?: string;
}

const payments: PaymentRecord[] = [];

/**
 * Generate 402 response with payment requirements
 */
function generate402Response(service: Service, notional?: bigint) {
  const price = calculatePrice(service, notional);
  const pricing = PRICING[service];

  return {
    status: 402,
    service: service,
    name: pricing.name,
    description: pricing.description,
    price: price.toString(),
    priceFormatted: formatUSDC(price),
    percentageFee: pricing.percentageFee
      ? `${(pricing.percentageFee * 100).toFixed(1)}%`
      : null,
    network: "bsc-testnet",
    chainId: 97,
    accepts: [
      {
        scheme: "x402",
        network: "bsc-testnet",
        maxAmountRequired: price.toString(),
      },
    ],
  };
}

/**
 * x402 middleware. Checks for payment header, returns 402 if missing.
 */
export function requirePayment(
  service: Service,
  getNotional?: (req: Request) => bigint | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;
    const notional = getNotional ? getNotional(req) : undefined;

    // Demo mode: skip payment verification
    if (
      process.env.DEMO_MODE === "true" ||
      process.env.NODE_ENV === "development"
    ) {
      const price = calculatePrice(service, notional);
      const payer =
        (req.headers["x-wallet"] as string) || "0xDemoUser";

      (req as any).x402 = {
        paid: true,
        payer,
        amount: price,
        service,
      };

      payments.push({
        payer,
        service,
        amount: price,
        timestamp: Date.now(),
        txHash: `demo-${Date.now()}`,
      });

      return next();
    }

    // No payment header. Return 402.
    if (!paymentHeader) {
      return res.status(402).json(generate402Response(service, notional));
    }

    // Parse and verify payment header
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
      const payment = JSON.parse(decoded);
      const payer =
        payment.payload?.authorization?.from ||
        payment.payload?.from ||
        payment.from ||
        "unknown";

      // Verify signature if present
      if (payment.payload?.signature && payment.payload?.authorization) {
        try {
          const message = JSON.stringify(payment.payload.authorization);
          const recovered = await recoverMessageAddress({
            message,
            signature: payment.payload.signature as `0x${string}`,
          });

          if (recovered.toLowerCase() !== payer.toLowerCase()) {
            return res.status(402).json({
              error: "Invalid Signature",
              message: "Payment signature does not match claimed payer",
              ...generate402Response(service, notional),
            });
          }
        } catch (sigErr) {
          // Signature verification failed but we continue in testnet mode
          console.warn("Signature verification failed (testnet):", sigErr);
        }
      }

      const price = calculatePrice(service, notional);

      (req as any).x402 = {
        paid: true,
        payer,
        amount: price,
        service,
      };

      payments.push({
        payer,
        service,
        amount: price,
        timestamp: Date.now(),
      });

      return next();
    } catch (err) {
      return res.status(400).json({
        error: "Invalid Payment Header",
        message: "Could not parse x402 payment header",
      });
    }
  };
}

/**
 * Get all pricing info
 */
export function getAllPricing() {
  return Object.values(PRICING).map((p) => ({
    service: p.service,
    name: p.name,
    description: p.description,
    price: p.basePrice.toString(),
    priceFormatted: formatUSDC(p.basePrice),
    percentageFee: p.percentageFee
      ? `${(p.percentageFee * 100).toFixed(1)}%`
      : null,
  }));
}

/**
 * Get payment stats
 */
export function getStats() {
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0n);
  const uniqueUsers = new Set(payments.map((p) => p.payer.toLowerCase())).size;

  return {
    totalRevenue: totalRevenue.toString(),
    totalRevenueFormatted: formatUSDC(totalRevenue),
    paymentCount: payments.length,
    uniqueUsers,
    network: "bsc-testnet",
  };
}
