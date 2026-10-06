"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { cn } from "@/lib/utils";

/** An amount in tabular numerals. `tone` colours it by direction: owed (mint), owe (coral), even (grey). */
export function Money({
  value,
  currency,
  sign = false,
  tone = false,
  countUp = false,
  className,
}: {
  value: number;
  currency: string;
  sign?: boolean;
  tone?: boolean;
  countUp?: boolean;
  className?: string;
}) {
  const { fmt } = useApp();
  const shown = useCountUp(value, countUp);
  return (
    <span
      className={cn(
        "money",
        tone && (value > 0 ? "text-owed" : value < 0 ? "text-owe" : "text-even"),
        className,
      )}
    >
      {fmt(shown, currency, { sign })}
    </span>
  );
}

/** Animates a number from its previous value (or 0) over ~600 ms. Respects reduced motion. */
export function useCountUp(target: number, enabled = true): number {
  // null = not animating, show the target as-is.
  const [frame, setFrame] = useState<number | null>(enabled ? 0 : null);
  const from = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      if (t < 1) {
        setFrame(Math.round(a + (target - a) * eased));
        raf = requestAnimationFrame(tick);
      } else {
        from.current = target;
        setFrame(null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  return frame ?? target;
}
