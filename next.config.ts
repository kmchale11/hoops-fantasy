import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { missingProductionSettings } from "./src/lib/config";

const nextConfig = (phase: string): NextConfig => {
  // Only the production deploy is checked, so local builds and preview deploys still work without keys.
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL_ENV === "production") {
    const problem = missingProductionSettings();
    if (problem) throw new Error(problem);
  }
  return config;
};

const config: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Keeps navigations and server actions pending, rather than failing, when the connection drops.
    useOffline: true,
  },
  async headers() {
    return [
      {
        // Browsers must always check for a new service worker, and run it only from this site.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
