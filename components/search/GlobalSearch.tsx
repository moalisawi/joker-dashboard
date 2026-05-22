"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Users, ArrowRight } from "lucide-react";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { useSearchStore } from "@/store/searchStore";

function statusColor(status: string): string {
  if (status === "نشط")           return "#5B5FEF";
  if (status === "ينتهي قريباً")  return "#F59E0B";
  if (status === "منتهي")         return "#9CA3AF";
  return "#EF4444";
}

export default function GlobalSearch() {
  const router = useRouter();
  const { can } = useAuthStore();
  const { subscribers } = useSubscribers();
  const { open, closeSearch, toggleSearch } = useSearchStore();

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

  const go = useCallback(
    (href: string) => {
      closeSearch();
      router.push(href);
    },
    [router, closeSearch]
  );

  if (!open) return null;

  const results = subscribers.slice(0, 50).map((s) => ({
    id:    s.id,
    title: s.name || "—",
    sub:   [s.phone, s.residence, s.package].filter(Boolean).join(" · "),
    href:  `/subscribers/${s.id}`,
    badge: s.subscriptionState === "withdrawn" ? "منسحب" : s.status,
    color: s.subscriptionState === "withdrawn" ? "#EF4444" : statusColor(s.status),
    searchValue: `${s.name} ${s.phone} ${s.residence} ${s.package} ${s.convincedBy}`.toLowerCase(),
  }));

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
            placeholder="ابحث عن مشترك بالاسم أو الهاتف أو الباقة..."
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
          <Command.Empty className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            لا توجد نتائج مطابقة
          </Command.Empty>

          <Command.Group
            heading={
              <span className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider block"
                style={{ color: "var(--text-muted)" }}>
                المشتركون
              </span>
            }
          >
            {results.map((r) => (
              <Command.Item
                key={r.id}
                value={r.searchValue}
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
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {r.title}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {r.sub}
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
