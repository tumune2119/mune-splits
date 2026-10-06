import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/components/app-provider";
import { getSettings } from "@/lib/store";
import { AUTO_EXIT } from "@/lib/app-lifetime";
import "./globals.css";

// Everything reads from the local SQLite database at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "MUNE Splits", template: "%s · MUNE Splits" },
  description: "Split trip and event expenses with friends. Stored locally.",
  applicationName: "MUNE Splits",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const settings = getSettings();
  return (
    <html lang="en" className={`${settings.theme} ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body>
        <AppProvider initial={settings}>
          <TooltipProvider delayDuration={300}>
            <AppShell launched={AUTO_EXIT}>{children}</AppShell>
          </TooltipProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </AppProvider>
      </body>
    </html>
  );
}
