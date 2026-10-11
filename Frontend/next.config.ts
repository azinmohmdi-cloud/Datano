import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const reviewEnabled =
    phase === PHASE_DEVELOPMENT_SERVER && process.env.UI_REVIEW_ENABLED === "1";

  return {
    // Review routes must not be discovered or bundled by a production build.
    pageExtensions: reviewEnabled
      ? ["review.tsx", "tsx", "ts", "jsx", "js"]
      : ["tsx", "ts", "jsx", "js"],
  };
}
