"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Swipe left / right to move between tabs (phones). The content follows the finger a little while
 * dragging, then either switches tab or springs back. Leaves alone: vertical scrolling, the
 * system back gesture at the screen edges, text fields, and anything that scrolls sideways itself.
 */
export function useSwipeTabs<T extends string>(
  area: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  tabs: readonly T[],
  current: T,
  go: (tab: T, from: "left" | "right") => void,
) {
  const latest = useRef({ tabs, current, go });
  useEffect(() => {
    latest.current = { tabs, current, go };
  });

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const EDGE = 24; // Android / iOS back gesture
    let start: { x: number; y: number; t: number } | null = null;
    let axis: "x" | "y" | null = null;
    let dx = 0;

    const neighbour = (dir: 1 | -1) => {
      const { tabs, current } = latest.current;
      return tabs[tabs.indexOf(current) + dir] ?? null;
    };
    const setX = (x: number, animate: boolean) => {
      const c = content.current;
      if (!c) return;
      c.style.transition = animate ? "transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1)" : "none";
      c.style.transform = x ? `translateX(${x}px)` : "";
    };
    const scrollsSideways = (node: EventTarget | null) => {
      for (let n = node as HTMLElement | null; n && n !== el; n = n.parentElement) {
        if (n.matches("input, textarea, select, [contenteditable], [data-no-swipe]")) return true;
        const ox = getComputedStyle(n).overflowX;
        if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = null;
      axis = null;
      dx = 0;
      if (e.touches.length !== 1 || t.clientX < EDGE || t.clientX > window.innerWidth - EDGE || scrollsSideways(e.target)) return;
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return;
      const t = e.touches[0];
      const mx = t.clientX - start.x;
      const my = t.clientY - start.y;
      if (!axis) {
        if (Math.hypot(mx, my) < 10) return;
        axis = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y";
      }
      if (axis !== "x") return;
      dx = mx;
      // Follow the finger; stiffer when there's no tab on that side.
      setX(dx * (neighbour(dx < 0 ? 1 : -1) ? 0.35 : 0.12), false);
    };
    const onEnd = () => {
      if (!start || axis !== "x") return void (start = null);
      const speed = Math.abs(dx) / Math.max(1, performance.now() - start.t);
      start = null;
      const next = neighbour(dx < 0 ? 1 : -1);
      if (next && (Math.abs(dx) > Math.min(90, window.innerWidth * 0.2) || (speed > 0.5 && Math.abs(dx) > 40))) {
        setX(0, false);
        latest.current.go(next, dx < 0 ? "right" : "left");
      } else setX(0, true);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [area, content]);
}
