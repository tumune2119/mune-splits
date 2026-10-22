import type { CapacitorConfig } from "@capacitor/cli";

// The Android/iOS app wraps the on-device build (`npm run build:local` → out/).
const config: CapacitorConfig = {
  appId: "io.github.tumune2119.munesplits",
  appName: "MUNE Splits",
  webDir: "out",
  backgroundColor: "#0e0e10",
  android: {
    // Android 15 draws apps edge-to-edge; keep content clear of the status and navigation bars.
    adjustMarginsForEdgeToEdge: "auto",
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#0e0e10",
  },
};

export default config;
