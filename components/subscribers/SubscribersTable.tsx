"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Subscriber } from "@/types";
import { formatNumber, formatDate, getWhatsAppLink } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import {
  Search, Pencil, RotateCcw, CreditCard, Eye, Phone,
  PauseCircle, Snowflake, Play, UserMinus, Trash2, X,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";

interface Props {
  subscribers: Subscriber[];
  onProfile: (s: Subscriber) => void;
  onEdit: (s: Subscriber) => void;
  onWithdraw: (s: Subscriber) => void;
  onDelete: (id: string, name: string) => void;
  onAddPayment: (s: Subscriber) => void;
  onRenew: (s: Subscriber) => void;
  onPause: (s: Subscriber) => void;
  onFreeze?: (s: Subscriber) => void;
  onResume?: (s: Subscriber) => void;
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (!sorted) return <ArrowUpDown size={11} className="opacity-30" />;
  return sorted === "asc"
    ? <ArrowUp size={11} className="text-indigo-500" />
    : <ArrowDown size={11} className="text-indigo-500" />;
}

export default function SubscribersTable({
  subscribers,
  onProfile,
  onEdit,
  onWithdraw,
  onDelete,
  onAddPayment,
  onRenew,
  onPause,
  onFreeze,
  onResume,
}: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const [search, setSearch]             = useState("");
  const [filterEmp, setFilterEmp]       = useState("");
  const [filterPkg, setFilterPkg]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTeam, setFilterTeam]     = useState("");
  const [pageSize, setPageSize]         = useState(10);
  const [sorting, setSorting]           = useState<SortingState>([]);

  const activeSubs = useMemo(
    () =>
      subscribers.filter(
        (s) => s.subscriptionStatus !== "paused" && s.freezeData?.isFrozen !== true
      ),
    [subscribers]
  );

  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    activeSubs.forEach((s) => { if (s.team?.trim()) names.add(s.team.trim()); });
    return [...names].sort((a, b) => a.localeCompare(b, "ar"));
  }, [activeSubs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeSubs.filter(
      (s) =>
        (!q ||
          s.name?.toLowerCase().includes(q) ||
          s.phone?.includes(q)) &&
        (!filterEmp    || s.convincedBy === filterEmp) &&
        (!filterPkg    || s.package     === filterPkg) &&
        (!filterStatus || s.status      === filterStatus) &&
        (!filterTeam   || s.team        === filterTeam)
    );
  }, [activeSubs, search, filterEmp, filterPkg, filterStatus, filterTeam]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<Subscriber, any>[]>(
    () => [
      { accessorKey: "date",         id: "date",         enableSorting: true },
      { accessorKey: "name",         id: "name",         enableSorting: true },
      { accessorKey: "expiryDate",   id: "expiryDate",   enableSorting: true },
      { accessorKey: "netAmountUSD", id: "netAmountUSD", enableSorting: true },
      { accessorKey: "status",       id: "status",       enableSorting: true },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: true,
  });

  const sortedData = table.getRowModel().rows.map((r) => r.original);
  const paged      = sortedData.slice(0, pageSize);

  const statusClass = useCallback((status: string) => {
    if (status === "نشط")         return "status-active";
    if (status === "ينتهي قريباً") return "status-expiring";
    if (status === "منتهي")       return "status-expired";
    if (status === "متجمد")       return "status-frozen";
    return "status-withdrawn";
  }, []);

  const empClass = useCallback((emp: string) => {
    if (emp === "حنان") return "badge-hanan";
    if (emp === "ميار") return "badge-mayar";
    return "badge-medo";
  }, []);

  const sortableHeader = (id: string, label: string, extraClass = "") => {
    const col = table.getColumn(id);
    if (!col) return <th className={`px-4 py-3 text-right font-semibold ${extraClass}`}>{label}</th>;
    return (
      <th
        className={`px-4 py-3 text-right font-semibold cursor-pointer select-none ${extraClass}`}
        onClick={col.getToggleSortingHandler()}
      >
        <span className="flex items-center gap-1 justify-end">
          {label}
          <SortIcon sorted={col.getIsSorted()} />
        </span>
      </th>
    );
  };

  return (
    <div className="panel overflow-hidden">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          background: "var(--jk-panel)",
          borderBottom: "1px solid var(--jk-divider)",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
          <Search
            size={14}
            style={{
              position: "absolute", top: "50%", transform: "translateY(-50%)",
              insetInlineEnd: 14, color: "var(--jk-subtle)", pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageSize(10); }}
            style={{ height: 38, fontSize: 13, paddingInlineEnd: 38 }}
            className="form-input"
          />
        </div>

        {/* Selects — width:auto يكسر الـ 100% من form-input */}
        <select
          value={filterEmp}
          onChange={(e) => setFilterEmp(e.target.value)}
          style={{ width: "auto", flex: "none", height: 38, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
          className="form-input cursor-pointer"
        >
          <option value="">كل الموظفين</option>
          {["حنان","ميار","ميدو"].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          value={filterPkg}
          onChange={(e) => setFilterPkg(e.target.value)}
          style={{ width: "auto", flex: "none", height: 38, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
          className="form-input cursor-pointer"
        >
          <option value="">كل الباقات</option>
          <option value="فضية">فضية</option>
          <option value="ذهبية">ذهبية</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: "auto", flex: "none", height: 38, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
          className="form-input cursor-pointer"
        >
          <option value="">كل الحالات</option>
          <option value="نشط">نشط</option>
          <option value="ينتهي قريباً">ينتهي قريباً</option>
          <option value="منتهي">منتهي</option>
          <option value="منسحب">منسحب</option>
          <option value="متجمد">متجمد</option>
        </select>

        {teamOptions.length > 0 && (
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{ width: "auto", flex: "none", height: 38, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
            className="form-input cursor-pointer"
          >
            <option value="">كل الفرق</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* العداد + مسح */}
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
          {(search || filterEmp || filterPkg || filterStatus || filterTeam) && (
            <button
              onClick={() => { setSearch(""); setFilterEmp(""); setFilterPkg(""); setFilterStatus(""); setFilterTeam(""); }}
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "5px 12px" }}
            >
              <X size={12} /> مسح
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--jk-muted)" }}>
            {filtered.length} / {activeSubs.length}
          </span>
        </div>
      </div>

      {/* ── Desktop Table ─────────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold sticky top-0 z-10"
                style={{ background: "#F3F5F8", color: "var(--jk-muted)", borderBottom: "2px solid var(--jk-border-strong)", letterSpacing: "0.03em" }}>
              <th className="hidden sm:table-cell px-4 py-3 text-right font-semibold">#</th>
              {sortableHeader("date",         "التاريخ",  "hidden sm:table-cell")}
              {sortableHeader("name",         "الاسم")}
              <th className="hidden lg:table-cell px-4 py-3 text-right font-semibold">الهاتف</th>
              <th className="px-4 py-3 text-right font-semibold">الباقة</th>
              {canRev && <th className="hidden xl:table-cell px-4 py-3 text-right font-semibold">المبلغ</th>}
              {canRev && <th className="hidden xl:table-cell px-4 py-3 text-right font-semibold">المدفوع</th>}
              {canRev && sortableHeader("netAmountUSD", "الصافي")}
              {sortableHeader("expiryDate",   "الانتهاء")}
              {sortableHeader("status",       "الحالة")}
              <th className="hidden lg:table-cell px-4 py-3 text-right font-semibold">الموظف</th>
              <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
                  لا توجد نتائج تطابق الفلاتر الحالية
                </td>
              </tr>
            )}
            {paged.map((s, i) => {
              const is15Day = s.daysRemaining > 7 && s.daysRemaining <= 15 && s.subscriptionState !== "withdrawn";
              const totalUSD = s.totalPriceUSD || s.netAmountUSD;
              const payPct = totalUSD > 0 ? Math.min(100, (s.paidAmountUSD / totalUSD) * 100) : 100;
              const isPartial = s.remainingAmountUSD > 0.01;
              const renewalBadge = s.isRenewal ? (s.isUpgrade ? " ↑" : s.isDowngrade ? " ↓" : " ↺") : "";

              return (
                <tr
                  key={s.id}
                  className="transition-colors duration-100"
                  style={{
                    borderBottom: "1px solid var(--border-soft)",
                    background: is15Day ? "rgba(245,158,11,0.04)" : undefined,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(243,245,248,.85)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = is15Day ? "rgba(245,158,11,0.04)" : ""; }}
                >
                  <td className="hidden sm:table-cell px-4 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                  <td className="hidden sm:table-cell px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(s.date)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Link href={`/subscribers/${s.id}`} className="flex items-center gap-2.5 group">
                      <span className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl text-[10px] font-black text-white"
                        style={{ background: "linear-gradient(135deg,#1E2332,#0B1020)", boxShadow: "0 2px 6px rgba(16,20,26,.18)", letterSpacing: "0.04em" }}>
                        {(s.name || "؟").split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold group-hover:text-blue-500 transition-colors" style={{ color: "var(--text-primary)" }}>
                        {s.name || "-"}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3.5 text-xs font-mono whitespace-nowrap" style={{ color: "var(--text-secondary)" }} dir="ltr">
                    {s.dialCode} {s.phone}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                        {s.package}{renewalBadge}
                      </span>
                      {s.renewalCount > 0 && (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-bold" title={`جُدِّد ${s.renewalCount} مرة`}>
                          ×{s.renewalCount}
                        </span>
                      )}
                    </div>
                  </td>
                  {canRev && (
                    <td className="hidden xl:table-cell px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {s.currencyOriginal !== "USD" && s.totalPrice
                        ? <><span className="font-semibold">{formatNumber(s.totalPrice, 2)}</span> <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>{s.currencyOriginal}</span><br/><span style={{ color: "var(--text-muted)" }}>≈${formatNumber(s.totalPriceUSD, 2)}</span></>
                        : `$${formatNumber(s.totalPriceUSD, 2)}`}
                    </td>
                  )}
                  {canRev && (
                    <td className="hidden xl:table-cell px-4 py-3.5 whitespace-nowrap">
                      <span className="font-semibold text-emerald-600 text-xs">${formatNumber(s.paidAmountUSD, 2)}</span>
                      {isPartial && <span className="text-xs text-amber-600 mr-1">/ ${formatNumber(s.remainingAmountUSD, 2)}</span>}
                      <div className="pay-bar">
                        <div className={`pay-bar-fill ${isPartial ? "partial" : ""}`} style={{ width: `${payPct}%` }} />
                      </div>
                    </td>
                  )}
                  {canRev && (
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-emerald-600 text-xs">${formatNumber(s.netAmountUSD, 2)}</span>
                      {(s.refundAmountUSD ?? 0) > 0 && <div className="text-rose-500 text-[10px]">-${formatNumber(s.refundAmountUSD ?? 0, 2)}</div>}
                      {s.renewalCount > 0 && s.lifetimeValueUSD > s.netAmountUSD && (
                        <div className="text-cyan-600 text-[10px]" title="إجمالي العمر">LTV ${formatNumber(s.lifetimeValueUSD, 0)}</div>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(s.expiryDate)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusClass(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${empClass(s.convincedBy)}`}>
                      {s.convincedBy || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onProfile(s)} title="التفاصيل"
                        className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700">
                        <Eye size={14} />
                      </button>
                      {can("canEdit") && (
                        <button onClick={() => onEdit(s)} title="تعديل"
                          className="p-1.5 rounded-lg transition-colors hover:bg-indigo-50 text-indigo-400 hover:text-indigo-700">
                          <Pencil size={14} />
                        </button>
                      )}
                      {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                        <button onClick={() => onRenew(s)} title="تجديد"
                          className="p-1.5 rounded-lg transition-colors hover:bg-cyan-50 text-cyan-400 hover:text-cyan-700">
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                        <button onClick={() => onAddPayment(s)} title="إضافة دفعة"
                          className="p-1.5 rounded-lg transition-colors hover:bg-sky-50 text-sky-400 hover:text-sky-700">
                          <CreditCard size={14} />
                        </button>
                      )}
                      <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noopener" title="واتساب"
                        className="p-1.5 rounded-lg transition-colors hover:bg-green-50 text-green-400 hover:text-green-700">
                        <Phone size={14} />
                      </a>
                      {can("canWithdraw") && s.subscriptionState !== "withdrawn" && s.daysRemaining > 0 && (
                        <button onClick={() => onPause(s)} title="إيقاف مؤقت"
                          className="p-1.5 rounded-lg transition-colors hover:bg-amber-50 text-amber-400 hover:text-amber-700">
                          <PauseCircle size={14} />
                        </button>
                      )}
                      {can("canWithdraw") && s.subscriptionState !== "withdrawn" && s.status === "نشط" && !s.freezeData?.isFrozen && (
                        <button onClick={() => onFreeze?.(s)} title="تجميد"
                          className="p-1.5 rounded-lg transition-colors hover:bg-blue-50 text-blue-400 hover:text-blue-700">
                          <Snowflake size={14} />
                        </button>
                      )}
                      {can("canWithdraw") && s.freezeData?.isFrozen && (
                        <button onClick={() => onResume?.(s)} title="استئناف"
                          className="p-1.5 rounded-lg transition-colors hover:bg-green-50 text-green-400 hover:text-green-700">
                          <Play size={14} />
                        </button>
                      )}
                      {can("canWithdraw") && s.subscriptionState !== "withdrawn" && (
                        <button onClick={() => onWithdraw(s)} title="انسحاب"
                          className="p-1.5 rounded-lg transition-colors hover:bg-rose-50 text-rose-400 hover:text-rose-700">
                          <UserMinus size={14} />
                        </button>
                      )}
                      {can("canDelete") && (
                        <button onClick={() => onDelete(s.id, s.name)} title="حذف"
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ──────────────────────────────────────────────────── */}
      <div className="md:hidden divide-y" style={{ borderColor: "var(--border)" }}>
        {paged.length === 0 && (
          <div className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            لا توجد نتائج
          </div>
        )}
        {paged.map((s) => {
          const isPartial = s.remainingAmountUSD > 0.01;
          return (
            <div key={s.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-[11px] font-black text-white mt-0.5"
                  style={{ background: "linear-gradient(135deg,#5B5FEF,#3B82F6)" }}>
                  {(s.name || "؟").split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/subscribers/${s.id}`} className="font-bold text-sm leading-tight hover:text-blue-500 transition-colors"
                    style={{ color: "var(--text-primary)" }}>
                    {s.name}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusClass(s.status)}`}>{s.status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>{s.package}</span>
                    {s.convincedBy && <span className={`text-xs px-2 py-0.5 rounded font-semibold ${empClass(s.convincedBy)}`}>{s.convincedBy}</span>}
                  </div>
                </div>
                <span className="text-xs whitespace-nowrap shrink-0 mt-1" style={{ color: "var(--text-muted)" }}>
                  {formatDate(s.expiryDate)}
                </span>
              </div>

              {canRev && (
                <div className="flex items-center gap-4 text-xs px-1">
                  <span style={{ color: "var(--text-muted)" }}>الصافي: <strong className="text-emerald-600">${formatNumber(s.netAmountUSD, 2)}</strong></span>
                  {isPartial && <span className="text-amber-600">متبقي ${formatNumber(s.remainingAmountUSD, 2)}</span>}
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => onProfile(s)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  <Eye size={12} /> تفاصيل
                </button>
                {can("canEdit") && (
                  <button onClick={() => onEdit(s)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                    <Pencil size={12} /> تعديل
                  </button>
                )}
                {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                  <button onClick={() => onRenew(s)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-cyan-50 text-cyan-700 hover:bg-cyan-100">
                    <RotateCcw size={12} /> تجديد
                  </button>
                )}
                {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                  <button onClick={() => onAddPayment(s)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-sky-50 text-sky-700 hover:bg-sky-100">
                    <CreditCard size={12} /> دفعة
                  </button>
                )}
                <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noopener"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100">
                  <Phone size={12} /> واتساب
                </a>
                {can("canWithdraw") && s.subscriptionState !== "withdrawn" && (
                  <button onClick={() => onWithdraw(s)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100">
                    <UserMinus size={12} /> انسحاب
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          عرض {Math.min(pageSize, filtered.length)} من {filtered.length}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>عرض:</span>
          {[10, 20, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setPageSize(n)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                pageSize === n ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
