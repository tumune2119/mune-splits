import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import { AppProvider, THEME_KEY } from "@/components/app-provider";
import "./globals.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "MUNE Splits", template: "%s · MUNE Splits" },
  description: "Split trip and event expenses with friends. Stored locally.",
  applicationName: "MUNE Splits",
  icons: {
    icon: [
      { url: `${base}/icons/icon.svg`, type: "image/svg+xml" },
      { url: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: `${base}/icons/apple-touch-icon.png`,
  },
  // iPhone "Add to Home Screen": full-screen app with a dark status bar.
  appleWebApp: { capable: true, title: "MUNE Splits", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e0e10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Paint in the last-used theme before React loads (no flash of the wrong theme).
const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"){var c=document.documentElement.classList;c.remove("dark");c.add("light")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppProvider>
          <TooltipProvider delayDuration={300}>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
          {/* On phones, keep notices above the bottom navigation bar. */}
          <Toaster position="bottom-right" richColors closeButton mobileOffset={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }} />
        </AppProvider>
      </body>
    </html>
  );
}
