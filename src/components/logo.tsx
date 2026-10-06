import { cn } from "@/lib/utils";

/**
 * MUNE Splits mark: the same rounded tile and "M" as MUNE TASKS, in pastel orange, with a split
 * circle (half filled) where Tasks has its spark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="ms-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFC29F" />
          <stop offset="1" stopColor="#FF9455" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#ms-logo)" />
      <path
        d="M13 47V22l14 15 14-15v25"
        stroke="#1C1009"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50.5" cy="17" r="5" fill="none" stroke="#1C1009" strokeWidth="2.2" />
      <path d="M50.5 12a5 5 0 0 1 0 10z" fill="#1C1009" />
    </svg>
  );
}

/** Two-tone wordmark in the MUNE TASKS style: MUNE in ink, SPLITS in pastel orange. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-[0.14em] whitespace-nowrap", className)}>
      MUNE <span className="text-brand-soft drop-shadow-[0_0_10px_rgb(255_148_85/0.4)] light:text-brand light:drop-shadow-none">SPLITS</span>
    </span>
  );
}
