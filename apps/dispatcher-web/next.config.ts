import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "knex"],
  // Lets the dev server's HMR websocket work when reached over Tailscale
  // (e.g. http://100.101.195.96:3000) instead of localhost — otherwise Next
  // silently blocks that cross-origin dev connection and the client hangs
  // forever on first load with no console error.
  allowedDevOrigins: ["100.101.195.96"],
};

export default nextConfig;
