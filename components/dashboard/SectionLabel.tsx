"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  delay?: number;
}

export default function SectionLabel({ icon, title, subtitle, action, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1], delay }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg, #5B5FEF 0%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(91,95,239,0.28)",
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div>
          <h2 style={{
            fontSize: 14.5, fontWeight: 800, color: "var(--jk-text)",
            margin: 0, letterSpacing: "-0.01em",
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: "var(--jk-subtle)", margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  );
}
