"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { Subscriber } from "@/types";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useEmployeeNames } from "@/hooks/useEmployeeNames";
import { usePaymentMethodsQuery } from "@/features/paymentMethods/hooks/usePaymentMethodsQuery";
import { SlidersHorizontal, BarChart3 } from "lucide-react";
import { CHART_PALETTE } from "@/lib/statusColors";
import type { PaymentMethodType } from "@/features/paymentMethods/types";

interface Props {
  subscribers: Subscriber[];
}

function getResidenceLabel(v: string) {
  return (
    RESIDENCE_COUNTRIES.find((c) => c.value === v)?.name ||
    PHONE_COUNTRIES.find((c) => c.iso === v)?.name ||
    v || "-"
  );
}


const PM_TYPE_COLORS: Record<PaymentMethodType, string> = {
  ewallet:       "#0EA5E9",
  bank:          "#6366F1",
  cash:          "#22C55E",
  crypto:        "#F59E0B",
  international: "#8B5CF6",
};

export default function AdvancedStats({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");
  const employeeNames = useEmployeeNames();
  const { data: paymentMethodDocs = [] } = usePaymentMethodsQuery();

  const [filterPkg, setFilterPkg]         = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterMonth, setFilterMonth]     = useState("");
  const [filterEmp, setFilterEmp]         = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [open, setOpen]                   = useState(false);

  const pmById   = useMemo(() => Object.fromEntries(paymentMethodDocs.map((m) => [m.id,   m])), [paymentMethodDocs]);
  const pmByName = useMemo(() => Object.fromEntries(paymentMethodDocs.map((m) => [m.name, m])), [paymentMethodDocs]);

  function resolvePaymentName(s: Subscriber): string {
    const pmId = (s as Subscriber & { paymentMethodId?: string }).paymentMethodId;
    if (pmId && pmById[pmId]) return pmById[pmId].name;
    if (s.payment && pmByName[s.payment]) return pmByName[s.payment].name;
    return s.payment || "";
  }

  const countries = useMemo(
    () => [...new Set(subscribers.map((s) => s.residence).filter(Boolean))].sort(),
    [subscribers]
  );
  const months = useMemo(
    // The month list and the filter both mean "won in this month".
    () => [...new Set(subscribers.map((s) => (s.firstSubscribedAt || s.date || "").slice(0, 7)).filter(Boolean))].sort().reverse(),
    [subscribers]
  );
  const paymentMethodOptions = useMemo(() => {
    const fromDb = paymentMethodDocs.map((m) => m.name);
    const fromSubs = [...new Set(subscribers.map((s) => resolvePaymentName(s)).filter(Boolean))];
    return [...new Set([...fromDb, ...fromSubs])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethodDocs, subscribers]);

  const filtered = useMemo(() => {
    return subscribers.filter(
      (s) =>
        (!filterPkg     || s.package === filterPkg) &&
        (!filterCountry || s.residence === filterCountry) &&
        (!filterMonth   || (s.firstSubscribedAt || s.date || "").slice(0, 7) === filterMonth) &&
        (!filterEmp     || s.convincedBy === filterEmp) &&
        (!filterPayment || resolvePaymentName(s) === filterPayment)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribers, filterPkg, filterCountry, filterMonth, filterEmp, filterPayment, pmById, pmByName]);

  const totals = useMemo(() => {
    const paid = filtered.reduce((a, s) => a + s.paidAmountUSD,      0);
    const rem  = filtered.reduce((a, s) => a + s.remainingAmountUSD, 0);
    return { count: filtered.length, total: paid + rem, paid, rem };
  }, [filtered]);

  const empStats = useMemo(() => {
    return employeeNames.map((emp) => {
      const d = filtered.filter((s) => s.convincedBy === emp);
      return { name: emp, count: d.length, rev: d.reduce((a, s) => a + s.netAmountUSD, 0) };
    }).sort((a, b) => b.rev - a.rev);
  }, [filtered, employeeNames]);
  const maxEmpRev = Math.max(...empStats.map((e) => e.rev), 1);

  const pmStats = useMemo(() => {
    const map: Record<string, { count: number; type: PaymentMethodType | null }> = {};
    filtered.forEach((s) => {
      const name = resolvePaymentName(s);
      if (!name) return;
      const pmId = (s as Subscriber & { paymentMethodId?: string }).paymentMethodId;
      const doc = pmById[pmId ?? ""] || pmByName[name];
      if (!map[name]) map[name] = { count: 0, type: doc?.type ?? null };
      map[name].count++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, count: v.count, type: v.type }))
      .sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, pmById, pmByName]);
  const maxPm = Math.max(...pmStats.map((p) => p.count), 1);

  const hasFilters = filterPkg || filterCountry || filterMonth || filterEmp || filterPayment;

  const summaryCards = [
    { label: "الاشتراكات",    value: formatNumber(totals.count),                           color: "var(--jk-text)" },
    { label: "إجمالي العقود", value: canRev ? `$${formatNumber(totals.total, 2)}` : "—",   color: "#5B5FEF" },
    { label: "المحصّل",       value: canRev ? `$${formatNumber(totals.paid,  2)}` : "—",   color: "#22C55E" },
    { label: "المتبقي",       value: canRev ? `$${formatNumber(totals.rem,   2)}` : "—",   color: "#F59E0B" },
  ];

  return (
    <div className="panel" style={{ marginBottom: 24, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 22px",
        borderBottom: "1px solid var(--jk-divider)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg, #5B5FEF, #7C3AED)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", flexShrink: 0,
            boxShadow: "0 4px 12px rgba(91,95,239,0.28)",
          }}>
            <BarChart3 size={13} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.01em" }}>
              الإحصائيات المتقدمة
            </h3>
            <p style={{ fontSize: 11, color: "var(--jk-subtle)", margin: 0 }}>تحليل شامل وفلترة ذكية</p>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 12, fontWeight: 600,
            padding: "7px 14px", borderRadius: 10,
            border: hasFilters ? "1px solid rgba(91,95,239,0.30)" : "1px solid var(--jk-border)",
            background: hasFilters ? "rgba(91,95,239,0.08)" : "var(--jk-panel)",
            color: hasFilters ? "#5B5FEF" : "var(--jk-muted)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <SlidersHorizontal size={13} />
          فلاتر{hasFilters ? " ●" : ""}
        </button>
      </div>

      {/* Filters panel */}
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid var(--jk-divider)",
            background: "var(--jk-panel)",
            display: "flex", flexWrap: "wrap", gap: 10,
          }}
        >
          {[
            { value: filterPkg,     onChange: setFilterPkg,     placeholder: "كل الباقات",    options: [{ v: "فضية", l: "فضية" }, { v: "ذهبية", l: "ذهبية" }] },
            { value: filterEmp,     onChange: setFilterEmp,     placeholder: "كل الموظفين",   options: employeeNames.map((e) => ({ v: e, l: e })) },
            { value: filterMonth,   onChange: setFilterMonth,   placeholder: "كل الأشهر",     options: months.map((m) => { const [y, mo] = m.split("-"); return { v: m, l: `${ARABIC_MONTHS[Number(mo) - 1]} ${y}` }; }) },
            { value: filterCountry, onChange: setFilterCountry, placeholder: "كل الدول",      options: countries.map((c) => ({ v: c, l: getResidenceLabel(c) })) },
            { value: filterPayment, onChange: setFilterPayment, placeholder: "طرق الدفع",     options: paymentMethodOptions.map((m) => ({ v: m, l: m })) },
          ].map((f, i) => (
            <select
              key={i}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              style={{
                height: 36, borderRadius: 10, border: "1px solid var(--jk-border)",
                background: "var(--jk-surface)", color: "var(--jk-text)",
                fontSize: 12.5, fontFamily: "inherit", padding: "0 12px",
                cursor: "pointer",
              }}
            >
              <option value="">{f.placeholder}</option>
              {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          ))}
          {hasFilters && (
            <button
              onClick={() => { setFilterPkg(""); setFilterCountry(""); setFilterMonth(""); setFilterEmp(""); setFilterPayment(""); }}
              style={{
                fontSize: 12, color: "#EF4444", fontWeight: 600,
                padding: "0 10px", background: "none", border: "none", cursor: "pointer",
              }}
            >
              مسح الكل
            </button>
          )}
        </motion.div>
      )}

      <div style={{ padding: "20px 22px" }}>
        {/* Summary numbers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
          {summaryCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{
                background: "var(--jk-panel)",
                borderRadius: 14, padding: "14px 16px",
                border: "1px solid var(--jk-divider)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 11, color: "var(--jk-subtle)", marginBottom: 6 }}>{c.label}</p>
              <p style={{ fontSize: 19, fontWeight: 800, color: c.color, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                {c.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {/* Employee breakdown */}
          <div>
            <h4 style={{
              fontSize: 11, fontWeight: 700, color: "var(--jk-muted)",
              letterSpacing: "0.06em", textTransform: "uppercase",
              marginBottom: 14,
            }}>
              أداء الموظفين
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {empStats.map((e, i) => {
                const bar = CHART_PALETTE[i % CHART_PALETTE.length];
                const pct = (e.rev / maxEmpRev) * 100;
                return (
                  <div key={e.name}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "var(--jk-text)",
                        padding: "3px 10px", borderRadius: 999,
                        background: `${bar}16`,
                        border: `1px solid ${bar}2A`,
                      }}>
                        {e.name}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--jk-subtle)", fontWeight: 500 }}>
                        {e.count} مشترك{canRev ? ` · $${formatNumber(e.rev, 0)}` : ""}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--jk-panel)", borderRadius: 99, overflow: "hidden", border: "1px solid var(--jk-divider)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], delay: i * 0.1 }}
                        style={{ height: "100%", borderRadius: 99, background: bar }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment method breakdown */}
          <div>
            <h4 style={{
              fontSize: 11, fontWeight: 700, color: "var(--jk-muted)",
              letterSpacing: "0.06em", textTransform: "uppercase",
              marginBottom: 14,
            }}>
              طرق الدفع
            </h4>
            {pmStats.length === 0 ? (
              <p style={{ color: "var(--jk-subtle)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                لا توجد بيانات
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pmStats.map(({ name, count, type }, i) => {
                  const barColor = type ? PM_TYPE_COLORS[type] : "#94A3B8";
                  const pct = (count / maxPm) * 100;
                  return (
                    <div key={name}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, color: "var(--jk-text)", fontWeight: 600 }}>{name}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999,
                          background: `${barColor}16`, color: barColor,
                          border: `1px solid ${barColor}2A`,
                        }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ height: 5, background: "var(--jk-panel)", borderRadius: 99, overflow: "hidden", border: "1px solid var(--jk-divider)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1], delay: i * 0.08 }}
                          style={{ height: "100%", borderRadius: 99, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
