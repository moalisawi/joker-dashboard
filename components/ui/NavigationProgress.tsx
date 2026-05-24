"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function NavigationProgress() {
  const pathname   = usePathname();
  const [active, setActive] = useState(false);
  const [pct, setPct]       = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => { if (timer.current) clearTimeout(timer.current); };

  // Intercept internal <a> clicks → start bar
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || /^https?:\/\//.test(href) || a.target === "_blank") return;

      clear();
      setActive(true);
      setPct(0);
      timer.current = setTimeout(() => setPct(80), 80);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  // Finish bar when route settles
  useEffect(() => {
    if (!active) return;
    clear();
    setPct(100);
    timer.current = setTimeout(() => { setActive(false); setPct(0); }, 500);
    return clear;
  }, [pathname]); // eslint-disable-line

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="nav-bar"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.1 } }}
          style={{
            position: "fixed", top: 0,
            insetInlineStart: 0, insetInlineEnd: 0,
            height: 3, zIndex: 10000, pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <motion.div
            style={{
              height: "100%",
              background: "linear-gradient(to left, #818CF8 0%, #5B5FEF 60%, #4338CA 100%)",
              transformOrigin: "right center",
              boxShadow: "0 0 10px rgba(91,95,239,0.55), 0 0 3px rgba(91,95,239,0.8)",
              borderRadius: "0 0 2px 0",
            }}
            animate={{ scaleX: pct / 100 }}
            transition={{
              duration: pct === 100 ? 0.22 : 1.4,
              ease: pct === 100 ? [0.4, 0, 0.2, 1] : "easeOut",
            }}
          />
          {/* Glowing dot at the tip */}
          <motion.div
            style={{
              position: "absolute", top: "50%",
              insetInlineStart: `${pct}%`,
              transform: "translate(-50%, -50%)",
              width: 6, height: 6, borderRadius: "50%",
              background: "#818CF8",
              boxShadow: "0 0 8px 2px rgba(91,95,239,0.7)",
            }}
            animate={{ opacity: pct === 100 ? 0 : 1 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
