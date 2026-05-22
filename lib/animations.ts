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

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let raf: number;
    let startTime: number | null = null;

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
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
