import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "knex"],
  // Lets the dev server's HMR websocket work when reached over Tailscale
  // (http://100.101.195.96:<port>) instead of localhost — otherwise Next
  // silently blocks that cross-origin dev connection and the client hangs
  // forever on first load with no console error.
  allowedDevOrigins: ["100.101.195.96"],
};

export default nextConfig;
