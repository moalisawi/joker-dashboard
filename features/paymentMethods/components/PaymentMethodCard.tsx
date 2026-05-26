"use client";

import { useState, useCallback } from "react";
import { Spinner } from "@heroui/react";
import {
  MoreVertical, Users, Download, Edit2, PowerOff, Trash2,
  Wallet, Building2, Banknote, Bitcoin, Globe,
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
    accent:    "#5B5FEF",
    accentBg:  "rgba(91,95,239,0.10)",
    accentBd:  "rgba(91,95,239,0.24)",
    glow:      "rgba(91,95,239,0.18)",
    Icon:      Wallet,
  },
  bank: {
    accent:    "#10B981",
    accentBg:  "rgba(16,185,129,0.10)",
    accentBd:  "rgba(16,185,129,0.24)",
    glow:      "rgba(16,185,129,0.14)",
    Icon:      Building2,
  },
  cash: {
    accent:    "#94A3B8",
    accentBg:  "rgba(100,116,139,0.10)",
    accentBd:  "rgba(100,116,139,0.20)",
    glow:      "rgba(100,116,139,0.10)",
    Icon:      Banknote,
  },
  crypto: {
    accent:    "#F59E0B",
    accentBg:  "rgba(245,158,11,0.10)",
    accentBd:  "rgba(245,158,11,0.24)",
    glow:      "rgba(245,158,11,0.14)",
    Icon:      Bitcoin,
  },
  international: {
    accent:    "#3B82F6",
    accentBg:  "rgba(59,130,246,0.10)",
    accentBd:  "rgba(59,130,246,0.24)",
    glow:      "rgba(59,130,246,0.14)",
    Icon:      Globe,
  },
} as const;

type TypeKey = keyof typeof TYPE_CONFIG;

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
      style={{ width: 26, height: 26, objectFit: "contain", borderRadius: 4 }}
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
  const [hovered, setHovered]   = useState(false);

  const { data: balance, isLoading: balanceLoading } =
    usePaymentMethodBalanceQuery(method.id, period);

  const isDisabled   = method.status === "disabled";
  const isActive     = method.status === "active";
  const countryLabel =
    method.scope === "global"
      ? "عالمية"
      : (COUNTRY_LABELS[method.country ?? ""] ?? method.country ?? "—");

  const net    = balance ? balance.totalUSD - balance.refundedUSD : 0;
  const cfg    = TYPE_CONFIG[method.type as TypeKey] ?? TYPE_CONFIG.cash;
  const { Icon } = cfg;

  const brand        = !method.logoUrl ? detectBrand(method.name) : null;
  const resolvedLogo = method.logoUrl ?? brand?.logoUrl ?? null;
  const iconColor    = brand?.color  ?? cfg.accent;
  const iconBg       = brand?.bgColor ?? cfg.accentBg;
  const iconBd       = brand?.bgColor
    ? brand.bgColor.replace(/[\d.]+\)$/, "0.28)")
    : cfg.accentBd;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius:   24,
        border:         `1px solid ${hovered ? cfg.accentBd : "rgba(255,255,255,0.80)"}`,
        background:     "rgba(255,255,255,0.72)",
        backdropFilter: "blur(22px) saturate(1.7)",
        WebkitBackdropFilter: "blur(22px) saturate(1.7)",
        boxShadow: hovered
          ? `0 2px 8px rgba(91,95,239,0.08), 0 20px 56px rgba(91,95,239,0.14), 0 0 0 1px ${cfg.accentBd}`
          : `0 1px 3px rgba(15,23,42,0.06), 0 8px 32px rgba(91,95,239,0.07)`,
        overflow:    "visible",
        position:    "relative",
        transition:  "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
        transform:   hovered ? "translateY(-3px)" : "translateY(0)",
        opacity:     isDisabled ? 0.62 : 1,
      }}
    >
      {/* Visual clipping layer — clips stripe + glow to border-radius */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit",
        overflow: "hidden", pointerEvents: "none", zIndex: 0,
      }}>
        {/* Top accent stripe */}
        <div style={{
          position: "absolute", top: 0, insetInline: 0, height: 3,
          background: `linear-gradient(90deg, ${cfg.accent}CC 0%, #5B5FEF99 50%, ${cfg.accent}55 100%)`,
          opacity: isActive ? 1 : 0.3,
        }} />
        {/* Radial glow overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 15% 0%, ${cfg.glow} 0%, transparent 60%)`,
          opacity: hovered ? 1 : 0.6,
          transition: "opacity .22s ease",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── TOP ROW ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Left: icon + currency pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: resolvedLogo ? "rgba(255,255,255,0.90)" : iconBg,
              border: `1.5px solid ${iconBd}`,
              color: iconColor,
              boxShadow: `0 2px 10px ${cfg.glow}`,
              overflow: "hidden",
            }}>
              {resolvedLogo ? (
                <BrandLogo
                  src={resolvedLogo} alt={method.name}
                  fallback={<Icon size={18} />}
                  fallbackBg={iconBg} fallbackColor={iconColor}
                />
              ) : (
                <Icon size={18} />
              )}
            </div>

            {/* Currency pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {method.supportedCurrencies.slice(0, 2).map((cur) => (
                <span key={cur} style={{
                  height: 22, padding: "0 8px", borderRadius: 999,
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
                  display: "inline-flex", alignItems: "center",
                  background: iconBg, border: `1px solid ${iconBd}`,
                  color: iconColor,
                }}>
                  {cur}
                </span>
              ))}
              {method.supportedCurrencies.length > 2 && (
                <span style={{
                  height: 22, padding: "0 8px", borderRadius: 999,
                  fontSize: 10, fontWeight: 700,
                  display: "inline-flex", alignItems: "center",
                  background: "rgba(15,23,42,0.05)", border: "1px solid rgba(15,23,42,0.10)",
                  color: "#6B7280",
                }}>
                  +{method.supportedCurrencies.length - 2}
                </span>
              )}
            </div>
          </div>

          {/* Right: status + menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              height: 24, padding: "0 10px", borderRadius: 999,
              fontSize: 10.5, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 5,
              whiteSpace: "nowrap",
              ...(isActive
                ? {
                    background: "rgba(16,185,129,0.10)",
                    color:      "#059669",
                    border:     "1px solid rgba(16,185,129,0.25)",
                  }
                : {
                    background: "rgba(100,116,139,0.08)",
                    color:      "#94A3B8",
                    border:     "1px solid rgba(100,116,139,0.18)",
                  }),
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: isActive ? "#10B981" : "#CBD5E1",
                flexShrink: 0,
              }} />
              {isActive ? "نشطة" : "معطّلة"}
            </span>

            {/* Dot menu */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#6B7280",
                  background: "rgba(255,255,255,0.65)",
                  border: "1px solid rgba(255,255,255,0.90)",
                  cursor: "pointer", transition: "all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.color = "#374151"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.65)"; e.currentTarget.style.color = "#6B7280"; }}
              >
                <MoreVertical size={13} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div style={{
                    position: "absolute", insetInlineEnd: 0, top: "calc(100% + 6px)",
                    zIndex: 50,
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(16px) saturate(1.5)",
                    WebkitBackdropFilter: "blur(16px) saturate(1.5)",
                    border: "1px solid rgba(255,255,255,0.90)",
                    borderRadius: 14,
                    boxShadow: "0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)",
                    minWidth: 148, overflow: "hidden", padding: "4px 0",
                  }}>
                    {[
                      { BtnIcon: Edit2,    label: "تعديل",                                        action: () => onEdit(method)   },
                      { BtnIcon: PowerOff, label: isActive ? "تعطيل" : "تفعيل",                   action: () => onToggle(method) },
                    ].map(({ BtnIcon, label, action }) => (
                      <button key={label}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 9,
                          padding: "9px 14px", fontSize: 12.5, fontWeight: 500,
                          color: "#374151", background: "transparent", border: "none",
                          cursor: "pointer", textAlign: "start", transition: "background .1s",
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(91,95,239,0.06)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        onClick={() => { setMenuOpen(false); action(); }}
                      >
                        <BtnIcon size={13} style={{ color: "#9CA3AF" }} /> {label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 10px" }} />
                    <button
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 9,
                        padding: "9px 14px", fontSize: 12.5, fontWeight: 500,
                        color: "#EF4444", background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "start", transition: "background .1s",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
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

        {/* ── TITLE SECTION ── */}
        <div>
          <div style={{
            fontSize: 17, fontWeight: 800, color: "#111827",
            letterSpacing: "-0.025em", lineHeight: 1.25,
          }}>
            {method.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500 }}>
              {getTypeLabel(method.type)}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#D1D5DB", flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500 }}>
              {countryLabel}
            </span>
          </div>
          {method.holderName && (
            <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2, fontWeight: 400 }}>
              {method.holderName}
            </div>
          )}
        </div>

        {/* ── BALANCE SECTION ── */}
        <div style={{
          borderRadius: 16,
          background: "rgba(15,20,40,0.04)",
          border: `1px solid rgba(91,95,239,0.10)`,
          overflow: "hidden",
        }}>
          {/* Balance header */}
          <div style={{
            padding: "9px 14px 7px",
            borderBottom: balanceLoading || (balance && method.supportedCurrencies.length > 0)
              ? "1px solid rgba(91,95,239,0.08)"
              : "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>
              الرصيد
            </span>
            <span style={{ fontSize: 10, color: "#C7D2FE", fontWeight: 600 }}>
              {method.supportedCurrencies.join(" · ")}
            </span>
          </div>

          {/* Balance rows */}
          {balanceLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}>
              <Spinner size="sm" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {method.supportedCurrencies.map((cur: SupportedCurrency, idx) => {
                const amt = balance?.perCurrency[cur] ?? 0;
                return (
                  <div key={cur} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    borderTop: idx > 0 ? "1px solid rgba(91,95,239,0.07)" : "none",
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                      color: iconColor,
                      background: iconBg,
                      border: `1px solid ${iconBd}`,
                      borderRadius: 7, padding: "2px 8px",
                    }}>
                      {cur}
                    </span>
                    <span style={{
                      fontSize: 17, fontWeight: 800, color: "#111827",
                      fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em",
                    }}>
                      {amt.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {balance && balance.refundedUSD > 0 && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 14px",
                  borderTop: "1px solid rgba(245,158,11,0.14)",
                  background: "rgba(245,158,11,0.04)",
                }}>
                  <span style={{ fontSize: 10.5, color: "#D97706", fontWeight: 600 }}>صافي بعد الاسترداد</span>
                  <span style={{ fontSize: 14, color: "#D97706", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    ${net.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ROW ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>

          {/* Subscriber pill */}
          <button
            onClick={() => onViewPayers(method)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999,
              background: iconBg, border: `1px solid ${iconBd}`,
              fontSize: 12, fontWeight: 700, color: iconColor,
              cursor: "pointer", transition: "all .15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = cfg.accentBg; e.currentTarget.style.opacity = "0.8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = iconBg; e.currentTarget.style.opacity = "1"; }}
          >
            <Users size={11} />
            {balance?.payerCount ?? 0} مشترك
          </button>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* View payers */}
            <button
              title="عرض المشتركين"
              onClick={() => onViewPayers(method)}
              style={{
                width: 32, height: 32, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.70)",
                border: "1px solid rgba(255,255,255,0.90)",
                color: "#6B7280", cursor: "pointer", transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(91,95,239,0.08)"; e.currentTarget.style.color = "#5B5FEF"; e.currentTarget.style.borderColor = "rgba(91,95,239,0.20)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.70)"; e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.90)"; }}
            >
              <Users size={13} />
            </button>

            {/* Export */}
            <button
              title="تصدير"
              onClick={() => onExport(method)}
              style={{
                width: 32, height: 32, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.70)",
                border: "1px solid rgba(255,255,255,0.90)",
                color: "#6B7280", cursor: "pointer", transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(91,95,239,0.08)"; e.currentTarget.style.color = "#5B5FEF"; e.currentTarget.style.borderColor = "rgba(91,95,239,0.20)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.70)"; e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.90)"; }}
            >
              <Download size={13} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
