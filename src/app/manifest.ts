import type { MetadataRoute } from "next";

// Static so the phone/web build (output: "export") can include it.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    id: `${base}/`,
    name: "MUNE Splits",
    short_name: "MUNE Splits",
    description: "Split trip and event expenses with friends. Stored locally.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0e10",
    theme_color: "#0e0e10",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${base}/icons/icon.svg`, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
