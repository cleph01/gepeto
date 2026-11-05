import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "knex"],
  // Lets the dev server's HMR websocket work when reached over Tailscale
  // (http://100.101.195.96:<port>) instead of localhost — otherwise Next
  // silently blocks that cross-origin dev connection and the client hangs
  // forever on first load with no console error.
  allowedDevOrigins: ["100.101.195.96"],
  // Tracking URLs carry a secret: keep them out of search engines and out of
  // Referer headers. Origin-only, not no-referrer, because OpenStreetMap's map
  // tiles require a Referer.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Referrer-Policy", value: "strict-origin" },
      ],
    }];
  },
};

export default nextConfig;
