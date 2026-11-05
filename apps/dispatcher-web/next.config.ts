import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "knex"],
  // Lets the dev server's HMR websocket work when reached over Tailscale
  // (e.g. http://100.101.195.96:3000) instead of localhost — otherwise Next
  // silently blocks that cross-origin dev connection and the client hangs
  // forever on first load with no console error.
  allowedDevOrigins: ["100.101.195.96"],
  // HSTS only takes effect over HTTPS, so Tailscale dev over HTTP isn't affected.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

export default nextConfig;
