"use client";

import { useState, useCallback } from "react";
import { Spinner } from "@heroui/react";
import {
  MoreVertical, Users, Download, Edit2, PowerOff, Trash2,
  Wallet, Building2, Banknote, Bitcoin, Globe, Bookmark,
} from "lucide-react";
import { getTypeLabel } from "./PaymentMethodTypeIcon";
import { usePaymentMethodBalanceQuery } from "../hooks/usePaymentMethodBalanceQuery";
import { detectBrand } from "../utils/brandLogos";
import type { PaymentMethod, BalancePeriod, SupportedCurrency } from "../types";

const COUNTRY_LABELS: Record<string, string> = {
  EG:      "مصر",
  PS_GAZA: "فلسطين - غزة",
  PS_WB:   "فلسطين - الضفة",
  PS_48:   "فلسطين - 48",
  JO:      "الأردن",
  SA:      "السعودية",
  AE:      "الإمارات",
};

const TYPE_CONFIG = {
  ewallet: {
    cardBg:      "linear-gradient(145deg, #EBF2FD 0%, #F5F9FF 55%, #FFFFFF 100%)",
    cardBorder:  "rgba(91,95,239,0.22)",
    glowColor:   "rgba(91,95,239,0.10)",
    iconColor:   "#5B5FEF",
    iconBg:      "rgba(91,95,239,0.15)",
    iconBorder:  "rgba(91,95,239,0.24)",
    badgeBg:     "rgba(91,95,239,0.12)",
    badgeBorder: "rgba(91,95,239,0.28)",
    badgeColor:  "#5a7fc4",
    Icon:        Wallet,
  },
  bank: {
    cardBg:      "linear-gradient(145deg, #E8F5EE 0%, #F3FAF6 55%, #FFFFFF 100%)",
    cardBorder:  "rgba(34,197,94,0.18)",
    glowColor:   "rgba(34,197,94,0.08)",
    iconColor:   "#22a854",
    iconBg:      "rgba(34,197,94,0.12)",
    iconBorder:  "rgba(34,197,94,0.20)",
    badgeBg:     "rgba(34,197,94,0.10)",
    badgeBorder: "rgba(34,197,94,0.24)",
    badgeColor:  "#16923e",
    Icon:        Building2,
  },
  cash: {
    cardBg:      "linear-gradient(145deg, #F1F3F6 0%, #F7F8FA 55%, #FFFFFF 100%)",
    cardBorder:  "rgba(100,116,139,0.16)",
    glowColor:   "rgba(100,116,139,0.06)",
    iconColor:   "#6B7280",
    iconBg:      "rgba(100,116,139,0.10)",
    iconBorder:  "rgba(100,116,139,0.18)",
    badgeBg:     "rgba(100,116,139,0.10)",
    badgeBorder: "rgba(100,116,139,0.22)",
    badgeColor:  "#6B7280",
    Icon:        Banknote,
  },
  crypto: {
    cardBg:      "linear-gradient(145deg, #EEF0FB 0%, #F4F3FF 55%, #FFFFFF 100%)",
    cardBorder:  "rgba(59,130,246,0.22)",
    glowColor:   "rgba(59,130,246,0.10)",
    iconColor:   "#3B82F6",
    iconBg:      "rgba(59,130,246,0.15)",
    iconBorder:  "rgba(59,130,246,0.24)",
    badgeBg:     "rgba(59,130,246,0.12)",
    badgeBorder: "rgba(59,130,246,0.28)",
    badgeColor:  "#7094bc",
    Icon:        Bitcoin,
  },
  international: {
    cardBg:      "linear-gradient(145deg, #FFF4E8 0%, #FFFBF2 55%, #FFFFFF 100%)",
    cardBorder:  "rgba(245,158,11,0.24)",
    glowColor:   "rgba(245,158,11,0.10)",
    iconColor:   "#d4933a",
    iconBg:      "rgba(245,158,11,0.15)",
    iconBorder:  "rgba(245,158,11,0.24)",
    badgeBg:     "rgba(245,158,11,0.14)",
    badgeBorder: "rgba(245,158,11,0.28)",
    badgeColor:  "#b07820",
    Icon:        Globe,
  },
} as const;

type TypeKey = keyof typeof TYPE_CONFIG;

// ── BrandLogo: loads image, shows fallback on error ───────────────────────────
function BrandLogo({
  src, alt, fallback, fallbackBg, fallbackColor,
}: {
  src: string; alt: string;
  fallback: React.ReactNode;
  fallbackBg: string; fallbackColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <span style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: fallbackBg, color: fallbackColor,
      }}>
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={src} alt={alt} onError={onError}
      style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4 }}
    />
  );
}

interface Props {
  method:       PaymentMethod;
  period:       BalancePeriod;
  onEdit:       (m: PaymentMethod) => void;
  onToggle:     (m: PaymentMethod) => void;
  onDelete:     (m: PaymentMethod) => void;
  onViewPayers: (m: PaymentMethod) => void;
  onExport:     (m: PaymentMethod) => void;
}

export function PaymentMethodCard({
  method, period, onEdit, onToggle, onDelete, onViewPayers, onExport,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: balance, isLoading: balanceLoading } =
    usePaymentMethodBalanceQuery(method.id, period);

  const isDisabled   = method.status === "disabled";
  const countryLabel =
    method.scope === "global"
      ? "عالمية"
      : (COUNTRY_LABELS[method.country ?? ""] ?? method.country ?? "—");

  const net    = balance ? balance.totalUSD - balance.refundedUSD : 0;
  const cfg    = TYPE_CONFIG[method.type as TypeKey] ?? TYPE_CONFIG.cash;
  const { Icon } = cfg;

  // Auto-detect brand logo from name if no manual logoUrl set
  const brand      = !method.logoUrl ? detectBrand(method.name) : null;
  const resolvedLogo = method.logoUrl ?? brand?.logoUrl ?? null;
  const iconColor  = brand?.color  ?? cfg.iconColor;
  const iconBg     = brand?.bgColor ?? cfg.iconBg;
  const iconBorder = brand?.bgColor
    ? brand.bgColor.replace(/[\d.]+\)$/, "0.28)")
    : cfg.iconBorder;

  return (
    <div
      style={{
        borderRadius:   22,
        border:         `1px solid ${cfg.cardBorder}`,
        background:     cfg.cardBg,
        boxShadow:      `0 1px 2px rgba(16,20,26,.04), 0 8px 24px -8px ${cfg.glowColor}`,
        overflow:       "hidden",
        position:       "relative",
        transition:     "transform .2s ease, box-shadow .2s ease",
        opacity:        isDisabled ? 0.58 : 1,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 2px rgba(16,20,26,.04), 0 16px 36px -8px ${cfg.glowColor}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 2px rgba(16,20,26,.04), 0 8px 24px -8px ${cfg.glowColor}`;
      }}
    >
      {/* Subtle inner highlight */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 15% 8%, rgba(255,255,255,0.75) 0%, transparent 55%)",
        borderRadius: "inherit",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Top row: icons + menu ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>

          {/* Icon pills (type + secondary) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Primary icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: resolvedLogo ? "#fff" : iconBg,
              border: `1px solid ${iconBorder}`,
              color: iconColor,
              boxShadow: `0 2px 8px ${cfg.glowColor}`,
              overflow: "hidden",
            }}>
              {resolvedLogo ? (
                <BrandLogo
                  src={resolvedLogo}
                  alt={method.name}
                  fallback={<Icon size={20} />}
                  fallbackBg={iconBg}
                  fallbackColor={iconColor}
                />
              ) : (
                <Icon size={20} />
              )}
            </div>

            {/* Currency pill */}
            <div style={{
              height: 30, borderRadius: 999, flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4,
              padding: "0 10px",
              background: "rgba(255,255,255,0.70)",
              border: `1px solid ${iconBorder}`,
              fontSize: 11, fontWeight: 700, color: iconColor,
              letterSpacing: "0.05em",
            }}>
              {method.supportedCurrencies.slice(0, 2).join(" · ")}
              {method.supportedCurrencies.length > 2 && <span style={{ color: "var(--jk-subtle)" }}>+{method.supportedCurrencies.length - 2}</span>}
            </div>
          </div>

          {/* Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Status pill */}
            <span style={{
              padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              whiteSpace: "nowrap",
              ...(method.status === "active"
                ? { background: cfg.badgeBg, color: cfg.badgeColor, border: `1px solid ${cfg.badgeBorder}` }
                : { background: "rgba(156,163,175,.10)", color: "var(--jk-subtle)", border: "1px solid rgba(156,163,175,.20)" }),
            }}>
              {method.status === "active" ? "مفعّلة" : "معطّلة"}
            </span>

            {/* Dots menu */}
            <div style={{ position: "relative" }}>
              <button
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--jk-muted)", background: "rgba(255,255,255,0.60)",
                  border: "1px solid rgba(255,255,255,0.85)",
                  cursor: "pointer", transition: "background .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.90)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.60)")}
                onClick={() => setMenuOpen(v => !v)}
              >
                <MoreVertical size={14} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div style={{
                    position: "absolute", insetInlineStart: 0, top: "calc(100% + 6px)",
                    zIndex: 50, background: "var(--jk-surface)",
                    border: "1px solid var(--jk-border)", borderRadius: 14,
                    boxShadow: "var(--jk-shadow-card)", minWidth: 140, overflow: "hidden",
                    padding: "4px 0",
                  }}>
                    {[
                      { BtnIcon: Edit2,    label: "تعديل",                                               action: () => onEdit(method)   },
                      { BtnIcon: PowerOff, label: method.status === "active" ? "تعطيل" : "تفعيل",        action: () => onToggle(method) },
                    ].map(({ BtnIcon, label, action }) => (
                      <button key={label}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 14px", fontSize: 12.5, fontWeight: 500,
                          color: "var(--jk-text)", background: "transparent", border: "none",
                          cursor: "pointer", textAlign: "start", transition: "background .1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--jk-panel)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        onClick={() => { setMenuOpen(false); action(); }}
                      >
                        <BtnIcon size={13} style={{ color: "var(--jk-muted)" }} /> {label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: "var(--jk-divider)", margin: "4px 10px" }} />
                    <button
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 14px", fontSize: 12.5, fontWeight: 500,
                        color: "#EF4444", background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "start", transition: "background .1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      onClick={() => { setMenuOpen(false); onDelete(method); }}
                    >
                      <Trash2 size={13} /> حذف
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Title + meta ── */}
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "var(--jk-text)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {method.name}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--jk-muted)", marginTop: 5, fontWeight: 500 }}>
            {getTypeLabel(method.type)} · {countryLabel}
          </div>
          {method.holderName && (
            <div style={{ fontSize: 12, color: "var(--jk-subtle)", marginTop: 3 }}>
              {method.holderName}
            </div>
          )}
        </div>

        {/* ── Balance per currency ── */}
        <div style={{
          background: "rgba(255,255,255,0.60)",
          borderRadius: 14, border: `1px solid ${cfg.cardBorder}`,
          padding: "12px 14px",
        }}>
          {balanceLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
              <Spinner size="sm" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {method.supportedCurrencies.map((cur: SupportedCurrency) => {
                const amt = balance?.perCurrency[cur] ?? 0;
                return (
                  <div key={cur} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em",
                      color: iconColor, background: iconBg,
                      border: `1px solid ${iconBorder}`,
                      borderRadius: 8, padding: "2px 8px",
                    }}>
                      {cur}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--jk-text)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {amt.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {balance && balance.refundedUSD > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: `1px solid ${cfg.cardBorder}` }}>
                  <span style={{ fontSize: 11, color: "var(--jk-warn)", fontWeight: 600 }}>صافي بعد الاسترداد</span>
                  <span style={{ fontSize: 13, color: "var(--jk-warn)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${net.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom row: subscriber badge + actions ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Subscriber count badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 999,
            background: iconBg,
            border: `1px solid ${iconBorder}`,
            fontSize: 12.5, fontWeight: 700, color: iconColor,
          }}>
            <Users size={12} />
            {balance?.payerCount ?? 0} مشترك
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              title="عرض المشتركين"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999,
                background: "rgba(255,255,255,0.65)", border: `1px solid ${cfg.cardBorder}`,
                color: "var(--jk-muted)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all .15s ease",
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.95)"; el.style.color = "var(--jk-text)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.65)"; el.style.color = "var(--jk-muted)"; }}
              onClick={() => onViewPayers(method)}
            >
              <Users size={12} />
            </button>
            <button
              title="تصدير"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999,
                background: "rgba(255,255,255,0.65)", border: `1px solid ${cfg.cardBorder}`,
                color: "var(--jk-muted)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all .15s ease",
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.95)"; el.style.color = "var(--jk-text)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.65)"; el.style.color = "var(--jk-muted)"; }}
              onClick={() => onExport(method)}
            >
              <Download size={12} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
