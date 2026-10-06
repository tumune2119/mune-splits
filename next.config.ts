import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module stays out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
