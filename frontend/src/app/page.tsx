"use client";

import dynamic from "next/dynamic";

const MarketPage = dynamic(() => import("@/components/MarketPage"), { ssr: false });

export default function Page() {
  return <MarketPage />;
}
