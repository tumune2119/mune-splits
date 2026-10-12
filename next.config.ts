import type { NextConfig } from "next";

// `npm run package:win` builds a self-contained copy (bundled server + node_modules) into its own
// folder, so it never disturbs the regular `.next` build used by `npm start` and the launcher.
const releaseBuild = process.env.MUNE_SPLITS_RELEASE === "1";

const nextConfig: NextConfig = {
  // Native module stays out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  ...(releaseBuild
    ? {
        output: "standalone" as const,
        distDir: ".next-release",
        // next/image isn't used, so its image optimiser binaries (sharp) stay out of the bundle.
        outputFileTracingExcludes: { "*": ["node_modules/sharp/**", "node_modules/@img/**"] },
      }
    : {}),
};

export default nextConfig;
