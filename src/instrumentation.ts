export async function register() {
  // Node.js server only (instrumentation also loads for the edge runtime, where process.exit doesn't exist).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWatchdog } = await import("./lib/app-lifetime");
    startWatchdog();
    const { cleanupReceipts } = await import("./lib/store");
    try {
      cleanupReceipts();
    } catch (err) {
      console.warn("[MUNE Splits] Receipt cleanup skipped:", (err as Error).message);
    }
  }
}
