import type { NextConfig } from "next";

/**
 * Three builds from one codebase:
 *  - desktop (default):     Next.js server + SQLite file (`npm run build`, the launcher)
 *  - desktop release:       the same, self-contained for the Windows installer (`npm run package:win`)
 *  - local (phone/web app): static files, data on the device via sql.js (`npm run build:local`),
 *                           packaged by Capacitor for Android/iOS and published on GitHub Pages
 */
const target = process.env.NEXT_PUBLIC_MUNE_TARGET === "local" ? "local" : process.env.MUNE_SPLITS_RELEASE === "1" ? "release" : "desktop";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // Native module stays out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  ...(target === "release"
    ? {
        output: "standalone" as const,
        distDir: ".next-release",
        // next/image isn't used, so its image optimiser binaries (sharp) stay out of the bundle.
        outputFileTracingExcludes: { "*": ["node_modules/sharp/**", "node_modules/@img/**"] },
      }
    : {}),
  ...(target === "local"
    ? {
        output: "export" as const,
        // With output: "export", distDir is where the static site is written.
        distDir: "out",
        basePath,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
