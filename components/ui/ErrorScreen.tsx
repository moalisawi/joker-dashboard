"use client";

import type { ReactNode } from "react";

/**
 * Shared full-page error/empty surface used by the App Router convention files
 * (app/error.tsx, app/global-error.tsx, app/not-found.tsx).
 *
 * Kept dependency-free on purpose: global-error.tsx renders outside the root
 * layout, so this component must not rely on providers (React Query, Auth,
 * HeroUI theme) that are mounted there.
 */
export default function ErrorScreen({
  code,
  title,
  description,
  detail,
  actions,
  tone = "danger",
}: {
  code?: string;
  title: string;
  description: string;
  /** Technical detail — rendered only when provided (dev / digest). */
  detail?: string;
  actions?: ReactNode;
  tone?: "danger" | "muted";
}) {
  const accent = tone === "danger" ? "var(--jk-danger, #EF4444)" : "var(--jk-muted, #6B7280)";
  const accentBg = tone === "danger" ? "rgba(239,68,68,0.08)" : "rgba(107,114,128,0.08)";

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--jk-bg, #F5F7FB)",
        fontFamily: "var(--font-cairo), system-ui, sans-serif",
        color: "var(--jk-text, #111827)",
      }}
    >
      <div className="jk-card" style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 18px",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: accentBg,
            color: accent,
          }}
        >
          <svg width="30" height="30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
              d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {code && (
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginBottom: 6 }}>{code}</div>
        )}

        <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
          {title}
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--jk-muted, #6B7280)", marginBottom: 20 }}>
          {description}
        </p>

        {detail && (
          <pre
            style={{
              textAlign: "left",
              direction: "ltr",
              fontSize: 11.5,
              lineHeight: 1.6,
              background: "var(--jk-panel, #F8FAFC)",
              border: "1px solid var(--jk-border, #E5E7EB)",
              borderRadius: 12,
              padding: "10px 12px",
              marginBottom: 20,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--jk-muted, #6B7280)",
            }}
          >
            {detail}
          </pre>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      </div>
    </div>
  );
}
