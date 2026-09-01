"use client";

import { useEffect, useState } from "react";
import type { Variants } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
const EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

// ─── Shared Variants ────────────────────────────────────────────────────────

export const fadeUpVariants: Variants = {
  hidden:   { opacity: 0, y: 18 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
};

export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

export const pageVariants: Variants = {
  hidden:   { opacity: 0, y: 10 },
  visible:  { opacity: 1, y: 0,  transition: { duration: 0.38, ease: EASE_OUT } },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.22 } },
};

export const scalePopVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.32, ease: EASE_SPRING } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.18 } },
};

// ─── Count-Up Hook ───────────────────────────────────────────────────────────

/**
 * Counts a figure up to its value, and — importantly — never leaves it short.
 *
 * requestAnimationFrame is throttled to a crawl in a background tab, so the
 * animation used to freeze part-way and leave a WRONG NUMBER on screen for as
 * long as the tab stayed hidden. On 31 Aug 2026 this cost real time: the
 * dashboard showed 3, then 4, then 19 subscribers on successive reads while the
 * true figure was 51, and it read exactly like a data regression. A decorative
 * animation must never be able to misreport a number.
 *
 * So the animation is now the exception, not the rule. It runs only when the
 * page is actually visible and the viewer has not asked for reduced motion;
 * otherwise the value appears immediately. If the tab is hidden mid-count the
 * value snaps to the target rather than freezing at whatever frame it reached.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Nothing to watch, or nobody watching: show the truth at once.
    if (typeof document === "undefined" || document.hidden || prefersReducedMotion) {
      setValue(target);
      return;
    }

    let raf: number;
    let startTime: number | null = null;

    const finish = () => { cancelAnimationFrame(raf); setValue(target); };
    const onVisibilityChange = () => { if (document.hidden) finish(); };

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed  = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };

    raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [target, duration]);

  return value;
}
