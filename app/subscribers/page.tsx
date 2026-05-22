"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Download, SlidersHorizontal, Eye, Pencil, RotateCcw,
  CreditCard, Snowflake, PauseCircle, Play, UserMinus, Phone, Trash2,
} from "lucide-react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { formatDate, formatNumber, getWhatsAppLink } from "@/lib/utils";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { toast } from "@/lib/toast";
import SubscriberModal from "@/components/subscribers/SubscriberModal";
import RenewalModal from "@/components/subscribers/RenewalModal";
import PaymentModal from "@/components/subscribers/PaymentModal";
import ProfileModal from "@/components/subscribers/ProfileModal";
import WithdrawModal from "@/components/subscribers/WithdrawModal";
import PauseModal from "@/components/subscribers/PauseModal";
import FreezeModal from "@/components/subscribers/FreezeModal";
import ResumeModal from "@/components/subscribers/ResumeModal";
import type { Subscriber } from "@/types";

// ── Status config ──────────────────────────────────────────────────────────────
type StatusKey = "الكل" | "نشط" | "ينتهي قريباً" | "منتهي" | "موقوف" | "متجمد" | "منسحب";

const STATUS_META: Record<Exclude<StatusKey, "الكل">, { color: string; bg: string }> = {
  "نشط":          { color: "#83A2DB", bg: "rgba(131,162,219,.15)" },
  "ينتهي قريباً": { color: "#E8B570", bg: "rgba(232,181,112,.15)" },
  "منتهي":        { color: "#CE6969", bg: "rgba(206,105,105,.15)" },
  "موقوف":        { color: "#E8B570", bg: "rgba(232,181,112,.15)"  },
  "متجمد":        { color: "#9DB4D6", bg: "rgba(157,180,214,.15)" },
  "منسحب":        { color: "#94a3b8", bg: "rgba(148,163,184,.15)" },
};

function getDisplayStatus(s: Subscriber): Exclude<StatusKey, "الكل"> {
  if (s.freezeData?.isFrozen)             return "متجمد";
  if (s.subscriptionStatus === "paused")  return "موقوف";
  if (s.subscriptionState === "withdrawn") return "منسحب";
  return (s.status as Exclude<StatusKey, "الكل">) ?? "نشط";
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const chars = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "؟";
  const palette = ["#83A2DB","#E8B570","#CE6969","#9DB4D6","#10b981","#8b5cf6","#f59e0b"];
  const c = palette[(name.charCodeAt(0) || 0) % palette.length];
  return (
    <span style={{
      width: 34, height: 34, borderRadius: "50%", background: c, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: "#fff",
    }}>{chars}</span>
  );
}

function StatusBadge({ status }: { status: Exclude<StatusKey, "الكل"> }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: m.bg, color: m.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function Spinner() {
  return (
    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block"/>
  );
}

function Btn({
  icon, title, color = "var(--jk-subtle)", onClick, loading, disabled,
}: { icon: React.ReactNode; title: string; color?: string; onClick: () => void; loading?: boolean; disabled?: boolean }) {
  const isDisabled = loading || disabled;
  return (
    <button title={title} onClick={onClick} disabled={isDisabled} style={{
      width: 28, height: 28, border: "none", borderRadius: 6,
      cursor: isDisabled ? "not-allowed" : "pointer",
      background: "transparent", color, display: "inline-flex",
      alignItems: "center", justifyContent: "center", transition: "background .1s",
      opacity: isDisabled ? 0.5 : 1,
    }}
      onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = "var(--jk-hover)"; }}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >{loading ? <Spinner /> : icon}</button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SubscribersPage() {
  const router = useRouter();
  const { user, can, exchangeRates } = useAuthStore();
  const { subscribers, loading } = useSubscribers();
  const canRev = can("canViewRevenue");

  const [activeTab, setActiveTab] = useState<StatusKey>("الكل");
  const [search, setSearch]       = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [modal, setModal]       = useState<
    "profile" | "edit" | "renew" | "payment" | "withdraw" | "pause" | "freeze" | "resume" | null
  >(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const open  = useCallback((m: typeof modal, s: Subscriber) => { setSelected(s); setModal(m); }, []);
  const close = useCallback(() => { setModal(null); setSelected(null); }, []);

  // per-tab counts
  const counts = useMemo(() => {
    const c = { "الكل": 0, "نشط": 0, "ينتهي قريباً": 0, "منتهي": 0, "موقوف": 0, "متجمد": 0, "منسحب": 0 } as Record<StatusKey, number>;
    for (const s of subscribers) {
      c["الكل"]++;
      const st = getDisplayStatus(s);
      c[st] = (c[st] ?? 0) + 1;
    }
    return c;
  }, [subscribers]);

  const employees = useMemo(() => {
    const n = new Set<string>();
    subscribers.forEach((s) => { if (s.convincedBy?.trim()) n.add(s.convincedBy.trim()); });
    return [...n].sort((a, b) => a.localeCompare(b, "ar"));
  }, [subscribers]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return subscribers.filter((s) => {
      const st = getDisplayStatus(s);
      return (
        (activeTab === "الكل" || st === activeTab) &&
        (!q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q)) &&
        (!filterEmp || s.convincedBy === filterEmp)
      );
    });
  }, [subscribers, activeTab, search, filterEmp]);

  const exportCSV = useCallback(() => {
    const hdr = ["الاسم","الهاتف","الباقة","الحالة","الانتهاء","الأيام","المبلغ","الموظف"];
    const data = rows.map((s) => [
      s.name, s.dialCode + s.phone, s.package, getDisplayStatus(s),
      s.expiryDate, s.daysRemaining, canRev ? `$${formatNumber(s.netAmountUSD)}` : "", s.convincedBy,
    ]);
    const csv = [hdr, ...data].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `مشتركون_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [rows, canRev]);

  const handleDelete = useCallback(async (s: Subscriber) => {
    if (!confirm(`حذف "${s.name}"؟`)) return;
    setLoadingId(`delete-${s.id}`);
    try {
      await callSubscriberOperation("deleteSubscriber", { subscriberId: s.id, subscriberName: s.name });
      toast.success("تم الحذف");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleResumePause = useCallback(async (s: Subscriber) => {
    if (!confirm(`استئناف اشتراك "${s.name}"؟`)) return;
    setLoadingId(`resume-${s.id}`);
    try {
      await callSubscriberOperation("resumePausedSubscription", { subscriberId: s.id });
      toast.success("تم الاستئناف");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  }, []);

  const TABS: StatusKey[] = ["الكل","نشط","ينتهي قريباً","منتهي","موقوف","متجمد","منسحب"];

  return (
    <ProtectedLayout>
      <div style={{ padding: "20px", minHeight: "100vh" }}>

        {/* ══ Table card ══════════════════════════════════════════════════════ */}
        <div className="panel" style={{ overflow: "hidden" }}>

          {/* ── Toolbar ──────────────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 14px",
            borderBottom: "1px solid var(--jk-divider)", flexWrap: "wrap",
          }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
              <Search size={14} style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                insetInlineEnd: 10, color: "var(--jk-subtle)", pointerEvents: "none",
              }} />
              <input
                type="text"
                placeholder="بحث باسم أو هاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ height: 36, paddingInlineEnd: 34, fontSize: 13 }}
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="btn-secondary"
              style={{
                height: 36, padding: "0 14px", fontSize: 13,
                display: "flex", alignItems: "center", gap: 6,
                background: showFilter ? "var(--jk-hover)" : undefined,
              }}
            >
              <SlidersHorizontal size={14} />
              تصفية
            </button>

            {/* Export */}
            <button
              onClick={exportCSV}
              className="btn-secondary"
              style={{ height: 36, padding: "0 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} />
              تصدير
            </button>
          </div>

          {/* ── Filter panel ─────────────────────────────────────────────── */}
          {showFilter && (
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid var(--jk-divider)",
              display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
              background: "var(--jk-hover)",
            }}>
              <select
                value={filterEmp}
                onChange={(e) => setFilterEmp(e.target.value)}
                className="form-input"
                style={{ height: 34, width: "auto", fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
              >
                <option value="">كل الموظفين</option>
                {employees.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              {filterEmp && (
                <button
                  onClick={() => setFilterEmp("")}
                  className="btn-secondary"
                  style={{ height: 34, padding: "0 10px", fontSize: 12 }}
                >
                  مسح
                </button>
              )}
            </div>
          )}

          {/* ── Status pills ─────────────────────────────────────────────── */}
          <div style={{
            display: "flex", gap: 6, padding: "10px 14px",
            borderBottom: "1px solid var(--jk-divider)", flexWrap: "wrap",
          }}>
            {TABS.map((tab) => {
              const active = tab === activeTab;
              const meta = tab === "الكل" ? null : STATUS_META[tab as Exclude<StatusKey,"الكل">];
              const badgeColor = meta?.color ?? "#64748b";
              const badgeBg   = meta?.bg    ?? "rgba(100,116,139,.15)";

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "5px 12px", borderRadius: 20, border: "1.5px solid",
                    borderColor: active ? "var(--jk-text)" : "var(--jk-divider)",
                    background: active ? "var(--jk-text)" : "transparent",
                    color: active ? "var(--surface)" : "var(--jk-subtle)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                  }}
                >
                  {tab}
                  <span style={{
                    minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10,
                    fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: active ? "rgba(255,255,255,.2)" : badgeBg,
                    color: active ? "#fff" : badgeColor,
                  }}>
                    {counts[tab] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Table ────────────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--jk-subtle)", fontSize: 14 }}>
              جارٍ التحميل...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--jk-subtle)", fontSize: 14 }}>
              لا يوجد مشتركون في هذه الحالة
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--jk-panel)", borderBottom: "1px solid var(--jk-divider)" }}>
                    {[
                      { label: "المشترك",         align: "right"  },
                      { label: "الخطة",            align: "right"  },
                      { label: "الحالة",           align: "right"  },
                      { label: "المبلغ",           align: "right"  },
                      { label: "تاريخ الانتهاء",   align: "right"  },
                      { label: "الأيام المتبقية",   align: "right"  },
                      { label: "موظف الخدمة",      align: "right"  },
                      { label: "الإجراءات",        align: "center" },
                    ].map(({ label, align }) => (
                      <th key={label} style={{
                        padding: "10px 14px", textAlign: align as "right" | "center",
                        fontSize: 12, fontWeight: 600, color: "var(--jk-subtle)",
                        whiteSpace: "nowrap",
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const st        = getDisplayStatus(s);
                    const isFrozen  = s.freezeData?.isFrozen;
                    const isPaused  = s.subscriptionStatus === "paused";
                    const isWithdrawn = s.subscriptionState === "withdrawn";
                    const isActive  = !isFrozen && !isPaused && !isWithdrawn;

                    // days display
                    let daysEl: React.ReactNode;
                    if (isPaused || isFrozen || isWithdrawn) {
                      daysEl = <span style={{ color: "var(--jk-subtle)" }}>—</span>;
                    } else if (s.daysRemaining < 0) {
                      daysEl = <span style={{ color: "#CE6969", fontWeight: 600 }}>متأخر {Math.abs(s.daysRemaining)} يوم</span>;
                    } else if (s.daysRemaining <= 7) {
                      daysEl = <span style={{ color: "#E8B570", fontWeight: 600 }}>{s.daysRemaining} يوم</span>;
                    } else {
                      daysEl = <span style={{ color: "var(--jk-text)" }}>{s.daysRemaining} يوم</span>;
                    }

                    return (
                      <tr
                        key={s.id}
                        style={{ borderBottom: "1px solid var(--jk-divider)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jk-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* المشترك */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ position: "relative" }}>
                              <Avatar name={s.name} />
                              <span style={{
                                position: "absolute", bottom: 0, insetInlineEnd: 0,
                                width: 9, height: 9, borderRadius: "50%", border: "1.5px solid var(--surface)",
                                background: isFrozen ? "#9DB4D6" : isPaused ? "#E8B570"
                                  : isWithdrawn ? "#94a3b8" : s.daysRemaining <= 0 ? "#CE6969"
                                  : s.daysRemaining <= 7 ? "#E8B570" : "#22c55e",
                              }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--jk-text)", lineHeight: 1.3 }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: "var(--jk-subtle)", direction: "ltr", textAlign: "right" }}>
                                {s.dialCode}{s.phone}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* الخطة */}
                        <td style={{ padding: "10px 14px", color: "var(--jk-text)", whiteSpace: "nowrap" }}>
                          {s.package}
                        </td>

                        {/* الحالة */}
                        <td style={{ padding: "10px 14px" }}>
                          <StatusBadge status={st} />
                        </td>

                        {/* المبلغ */}
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {canRev
                            ? <span style={{ fontWeight: 600, color: "var(--jk-text)" }}>${formatNumber(s.netAmountUSD)}</span>
                            : <span style={{ color: "var(--jk-subtle)" }}>—</span>}
                        </td>

                        {/* تاريخ الانتهاء */}
                        <td style={{ padding: "10px 14px", color: "var(--jk-subtle)", whiteSpace: "nowrap" }}>
                          {isFrozen && s.freezeData?.originalExpiryDate
                            ? s.freezeData.originalExpiryDate
                            : formatDate(s.expiryDate) || "—"}
                        </td>

                        {/* الأيام المتبقية */}
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {daysEl}
                        </td>

                        {/* موظف الخدمة */}
                        <td style={{ padding: "10px 14px" }}>
                          {s.convincedBy ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 30, height: 30, borderRadius: "50%",
                              background: "rgba(131,162,219,.15)", color: "#83A2DB",
                              fontSize: 12, fontWeight: 700,
                            }} title={s.convincedBy}>
                              {s.convincedBy.charAt(0)}
                            </span>
                          ) : <span style={{ color: "var(--jk-subtle)" }}>—</span>}
                        </td>

                        {/* الإجراءات */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "center" }}>
                            <Btn title="عرض الملف" icon={<Eye size={13} />}
                              onClick={() => router.push(`/subscribers/${s.id}`)} />

                            {can("canEdit") && isActive && (
                              <Btn title="تعديل" icon={<Pencil size={13} />} onClick={() => open("edit", s)} />
                            )}
                            {can("canEdit") && (
                              <Btn title="تجديد" icon={<RotateCcw size={13} />} onClick={() => open("renew", s)} />
                            )}
                            {can("canEdit") && (
                              <Btn title="دفعة" icon={<CreditCard size={13} />} onClick={() => open("payment", s)} />
                            )}

                            <Btn title="واتساب" icon={<Phone size={13} />}
                              onClick={() => window.open(getWhatsAppLink(s.dialCode, s.phone))} />

                            {/* تجميد / استئناف تجميد */}
                            {can("canEdit") && (isFrozen
                              ? <Btn title="استئناف الاشتراك" color="#9DB4D6"
                                  icon={<Play size={13} />} onClick={() => open("resume", s)} />
                              : isActive && <Btn title="تجميد" icon={<Snowflake size={13} />}
                                  onClick={() => open("freeze", s)} />
                            )}

                            {/* إيقاف / استئناف إيقاف */}
                            {can("canEdit") && (isPaused
                              ? <Btn title="استئناف الإيقاف" color="#E8B570"
                                  icon={<Play size={13} />}
                                  loading={loadingId === `resume-${s.id}`}
                                  disabled={loadingId !== null}
                                  onClick={() => handleResumePause(s)} />
                              : isActive && <Btn title="إيقاف مؤقت" icon={<PauseCircle size={13} />}
                                  onClick={() => open("pause", s)} />
                            )}

                            {can("canWithdraw") && isActive && (
                              <Btn title="انسحاب" color="#CE6969"
                                icon={<UserMinus size={13} />} onClick={() => open("withdraw", s)} />
                            )}
                            {can("canDelete") && (
                              <Btn title="حذف" color="#CE6969"
                                icon={<Trash2 size={13} />}
                                loading={loadingId === `delete-${s.id}`}
                                disabled={loadingId !== null}
                                onClick={() => handleDelete(s)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading && rows.length > 0 && (
            <div style={{
              padding: "9px 14px", borderTop: "1px solid var(--jk-divider)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 12, color: "var(--jk-subtle)",
            }}>
              <span>{rows.length} مشترك</span>
              {canRev && (
                <span>
                  الإجمالي:{" "}
                  <strong style={{ color: "var(--jk-text)" }}>
                    ${formatNumber(rows.reduce((a, s) => a + s.netAmountUSD, 0))}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ Modals ══════════════════════════════════════════════════════════ */}
      {selected && modal === "profile" && (
        <ProfileModal subscriber={selected} onClose={close}
          onEdit={() => open("edit", selected)}
          onRenew={() => open("renew", selected)}
          onAddPayment={() => open("payment", selected)} />
      )}
      {selected && modal === "edit" && (
        <SubscriberModal mode="edit" subscriber={selected} exchangeRates={exchangeRates}
          onClose={close} onSaved={close} />
      )}
      {selected && modal === "renew" && (
        <RenewalModal subscriber={selected} exchangeRates={exchangeRates}
          onClose={close} onSaved={close} />
      )}
      {selected && modal === "payment" && (
        <PaymentModal subscriber={selected} exchangeRates={exchangeRates}
          onClose={close} onSaved={close} />
      )}
      {selected && modal === "withdraw" && (
        <WithdrawModal subscriber={selected} exchangeRates={exchangeRates}
          onClose={close} onSaved={close} />
      )}
      {selected && modal === "pause" && (
        <PauseModal subscriber={selected} onClose={close} onSaved={close} />
      )}
      {selected && modal === "freeze" && (
        <FreezeModal subscriber={selected} isOpen onClose={close} onFrozen={close}
          currentUser={{ uid: user?.uid ?? "", displayName: user?.name ?? "" }} />
      )}
      {selected && modal === "resume" && (
        <ResumeModal subscriber={selected} isOpen onClose={close} onResumed={close}
          currentUser={{ uid: user?.uid ?? "", displayName: user?.name ?? "" }} />
      )}
    </ProtectedLayout>
  );
}
