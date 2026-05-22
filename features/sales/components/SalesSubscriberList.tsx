"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Subscriber } from "@/types";
import { Search, ArrowLeft, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const ACC = { indigo:"#83A2DB", emerald:"#83A2DB", amber:"#E8B570", rose:"#CE6969" };

function StatusDot({ status }: { status: string }) {
  if (status === "نشط")         return <CheckCircle2 size={12} style={{ color:ACC.emerald }}/>;
  if (status === "ينتهي قريباً") return <AlertCircle  size={12} style={{ color:ACC.amber }}/>;
  return <XCircle size={12} style={{ color:ACC.rose }}/>;
}

function statusColor(s: string) {
  if (s === "نشط")          return ACC.emerald;
  if (s === "ينتهي قريباً") return ACC.amber;
  return ACC.rose;
}

interface Props {
  subscribers: Subscriber[];
  canRev:      boolean;
}

export default function SalesSubscriberList({ subscribers, canRev }: Props) {
  const [search,     setSearch]     = useState("");
  const [statusFilt, setStatusFilt] = useState<"all"|"نشط"|"منتهي">("all");
  const [pkgFilt,    setPkgFilt]    = useState<"all"|"فضية"|"ذهبية">("all");
  const [page,       setPage]       = useState(1);
  const PAGE = 15;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.phone?.includes(q)) return false;
      if (statusFilt !== "all" && s.status !== statusFilt) return false;
      if (pkgFilt    !== "all" && s.package !== pkgFilt)   return false;
      return true;
    });
  }, [subscribers, search, statusFilt, pkgFilt]);

  const visible  = filtered.slice(0, page * PAGE);
  const hasMore  = visible.length < filtered.length;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>

      {/* Header + filters */}
      <div className="px-5 py-4 border-b space-y-3" style={{ borderColor:"var(--border)" }}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
            المشتركون ({filtered.length})
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color:"var(--text-muted)" }}/>
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="form-input w-full pr-9 text-sm"
            placeholder="بحث بالاسم أو الهاتف..."
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {(["all","نشط","منتهي"] as const).map((v) => (
            <button key={v}
              onClick={() => { setStatusFilt(v); setPage(1); }}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: statusFilt === v ? `${ACC.indigo}18` : "var(--surface-2)",
                color:      statusFilt === v ? ACC.indigo : "var(--text-muted)",
                border:     `1px solid ${statusFilt === v ? ACC.indigo+"40" : "var(--border)"}`,
              }}>
              {v === "all" ? "الكل" : v}
            </button>
          ))}
          <div className="w-px" style={{ background:"var(--border)" }}/>
          {(["all","فضية","ذهبية"] as const).map((v) => (
            <button key={v}
              onClick={() => { setPkgFilt(v); setPage(1); }}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: pkgFilt === v ? `${ACC.amber}18` : "var(--surface-2)",
                color:      pkgFilt === v ? ACC.amber : "var(--text-muted)",
                border:     `1px solid ${pkgFilt === v ? ACC.amber+"40" : "var(--border)"}`,
              }}>
              {v === "all" ? "كل الباقات" : v}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-xs text-center py-10" style={{ color:"var(--text-muted)" }}>
          لا توجد نتائج
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom:"1px solid var(--divider)" }}>
                  {["المشترك","الباقة","الحالة","تاريخ الانضمام",canRev?"المدفوع":"",""].map((h, i) => (
                    h && <th key={i} className="px-5 py-2.5 text-right font-semibold"
                      style={{ color:"var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-[#83A2DB08]"
                    style={{ borderBottom:"1px solid var(--divider)" }}>
                    <td className="px-5 py-3">
                      <p className="font-semibold" style={{ color:"var(--text-primary)" }}>{s.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color:"var(--text-muted)" }}>
                        {s.dialCode} {s.phone}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.package==="ذهبية"?"pkg-gold":"pkg-silver"}`}>
                        {s.package}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color:statusColor(s.status) }}>
                        <StatusDot status={s.status}/>{s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color:"var(--text-secondary)" }}>
                      {formatDate(s.date)}
                    </td>
                    {canRev && (
                      <td className="px-5 py-3 font-bold tabular-nums whitespace-nowrap"
                        style={{ color:ACC.emerald }}>
                        ${formatNumber(s.paidAmountUSD, 0)}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <Link href={`/subscribers/${s.id}`}
                        className="p-1.5 rounded-lg transition-colors hover:opacity-70 inline-flex"
                        style={{ color:ACC.indigo }}>
                        <ArrowLeft size={13}/>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-5 pb-4 pt-2">
              <button onClick={() => setPage((p) => p + 1)}
                className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{ background:"var(--surface-2)", color:"var(--text-secondary)", border:"1px solid var(--border)" }}>
                تحميل المزيد ({filtered.length - visible.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
