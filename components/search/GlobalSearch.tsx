"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Users, ArrowRight } from "lucide-react";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { useSearchStore } from "@/store/searchStore";
import { searchCustomers } from "@/lib/customerSearch";

/** How many rows are drawn. A limit on painting, never on matching. */
const MAX_RENDERED = 40;

/** "باقٍ 12 يوماً" / "منتهٍ منذ 3 أيام" — the number an employee asks for first. */
function daysLabel(days: number | undefined): string | null {
  if (days == null || Number.isNaN(days)) return null;
  if (days < 0) return `منتهٍ منذ ${Math.abs(days)} يوماً`;
  if (days === 0) return "ينتهي اليوم";
  return `باقٍ ${days} يوماً`;
}

function statusColor(status: string): string {
  if (status === "نشط")           return "#5B5FEF";
  if (status === "ينتهي قريباً")  return "#F59E0B";
  if (status === "منتهي")         return "#9CA3AF";
  return "#EF4444";
}

export default function GlobalSearch() {
  const router = useRouter();

  const { subscribers } = useSubscribers();
  const { open, closeSearch, toggleSearch } = useSearchStore();

  /*
   * The query lives here rather than inside cmdk because cmdk's own filtering is
   * switched off (`shouldFilter={false}`) — and nothing had taken over from it,
   * which is why typing did nothing at all.
   */
  const [query, setQuery] = useState("");

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSearch]);

  /*
   * Clear the box when the palette closes, so it never reopens showing
   * yesterday's search as if it were fresh. Adjusted during render rather than
   * in an effect — an effect would render the stale query once first.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setQuery("");
  }

  const go = useCallback(
    (href: string) => {
      closeSearch();
      router.push(href);
    },
    [router, closeSearch]
  );

  if (!open) return null;

  /*
   * Match first, cap second — the previous order made the 51st subscriber
   * unreachable by any query. The cap that remains is a drawing limit on an
   * already-filtered list, and the count below says when it is hiding anything.
   */
  const matched = searchCustomers(subscribers, query);
  const results = matched.slice(0, MAX_RENDERED).map((s) => ({
    id:    s.id,
    title: s.name || "—",
    phone: [s.dialCode, s.phone].filter(Boolean).join(" "),
    href:  `/subscribers/${s.id}`,
    badge: s.subscriptionState === "withdrawn" ? "منسحب" : s.status,
    color: s.subscriptionState === "withdrawn" ? "#EF4444" : statusColor(s.status),
    // Everything an employee needs before deciding to open the record.
    meta: [
      s.team || null,
      s.package || null,
      s.expiryDate ? `ينتهي ${s.expiryDate}` : null,
      s.subscriptionState === "withdrawn" ? null : daysLabel(s.daysRemaining),
    ].filter(Boolean).join(" · "),
    owed: (s.remainingAmountUSD ?? 0) > 0 ? s.remainingAmountUSD : 0,
  }));
  const hidden = matched.length - results.length;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      style={{ background: "rgba(16,20,26,.45)", backdropFilter: "blur(8px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeSearch(); }}
    >
      <Command
        dir="rtl"
        className="w-full max-w-xl overflow-hidden"
        style={{
          background: "var(--jk-surface)",
          boxShadow: "var(--jk-shadow-modal)",
          border: "1px solid var(--jk-border)",
          borderRadius: 28,
        }}
        shouldFilter={false}
      >
        {/* ── Search input ─────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <Search size={17} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="ابحث بالاسم أو الرقم — بأي صيغة"
            className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
            style={{ color: "var(--text-primary)" }}
          />
          <kbd
            className="shrink-0 hidden sm:inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Esc
          </kbd>
        </div>

        {/* ── Results list ─────────────────────────────────────────────── */}
        <Command.List className="max-h-[380px] overflow-y-auto py-2 overscroll-contain">
          {results.length === 0 && (
            <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              لا توجد نتائج مطابقة
            </p>
          )}

          <Command.Group
            heading={
              <span className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider block"
                style={{ color: "var(--text-muted)" }}>
                المشتركون
                {query.trim() && (
                  <span style={{ fontWeight: 500 }}>
                    {"  "}
                    <bdi dir="ltr">{matched.length}</bdi>
                    {hidden > 0 ? ` — يُعرض أول ${MAX_RENDERED}` : ""}
                  </span>
                )}
              </span>
            }
          >
            {results.map((r) => (
              <Command.Item
                key={r.id}
                value={r.id}
                onSelect={() => go(r.href)}
                className="flex items-center gap-3 px-4 py-2.5 text-right cursor-pointer transition-colors outline-none"
                style={{
                  // cmdk adds data-selected="true" on active item
                  borderRadius: 0,
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center"
                  style={{ background: `${r.color}24`, border: `1px solid ${r.color}48`, borderRadius: "50%" }}
                >
                  <Users size={14} style={{ color: r.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {r.title}
                    </p>
                    {r.phone && (
                      <bdi dir="ltr" className="text-[11.5px] shrink-0" style={{ color: "var(--text-muted)" }}>
                        {r.phone}
                      </bdi>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {r.meta}
                    {r.owed > 0 && (
                      <>
                        {" · متبقٍّ "}
                        {/* Isolated so the sign stays left of the digits in RTL. */}
                        <bdi dir="ltr" style={{ fontWeight: 700 }}>
                          {"$" + r.owed.toFixed(r.owed % 1 === 0 ? 0 : 2)}
                        </bdi>
                      </>
                    )}
                  </p>
                </div>
                {r.badge && (
                  <span
                    className="shrink-0"
                    style={{ background: `${r.color}24`, color: r.color, border: `1px solid ${r.color}48`, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}
                  >
                    {r.badge}
                  </span>
                )}
                <ArrowRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        {/* ── Footer shortcuts ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 text-[11px]"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <span className="flex items-center gap-1.5">
            <kbd className="kbd-hint">↑↓</kbd> تنقل
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd-hint">Enter</kbd> فتح
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd-hint">Esc</kbd> إغلاق
          </span>
        </div>
      </Command>

      {/* cmdk selected item highlight */}
      <style>{`
        [cmdk-item][data-selected="true"] {
          background: var(--jk-panel);
        }
        [cmdk-item] {
          transition: background 80ms;
        }
      `}</style>
    </div>
  );
}
