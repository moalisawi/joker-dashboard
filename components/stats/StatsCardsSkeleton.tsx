"use client";

import { motion } from "framer-motion";

function SkeletonCard({ delay = 0, featured = false }: { delay?: number; featured?: boolean }) {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" as const, delay }}
      style={{
        borderRadius: 22,
        padding: "22px 22px 20px",
        minHeight: 148,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: featured
          ? "linear-gradient(135deg, rgba(91,95,239,0.18) 0%, rgba(67,56,202,0.12) 100%)"
          : "var(--jk-surface)",
        border: featured
          ? "1px solid rgba(91,95,239,0.20)"
          : "1px solid var(--jk-border)",
        boxShadow: "var(--jk-shadow-stat)",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: featured ? "rgba(91,95,239,0.22)" : "var(--jk-divider)",
        }} />
        <div style={{
          width: 56, height: 24, borderRadius: 999,
          background: featured ? "rgba(91,95,239,0.18)" : "var(--jk-divider)",
        }} />
      </div>

      {/* Value + label */}
      <div>
        <div style={{
          width: "55%", height: 30, borderRadius: 8, marginBottom: 8,
          background: featured ? "rgba(91,95,239,0.22)" : "var(--jk-divider)",
        }} />
        <div style={{
          width: "70%", height: 13, borderRadius: 6,
          background: featured ? "rgba(91,95,239,0.15)" : "var(--jk-divider)",
        }} />
      </div>
    </motion.div>
  );
}

export default function StatsCardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} delay={i * 0.06} featured={i === 0} />
      ))}
    </div>
  );
}
