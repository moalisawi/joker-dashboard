"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, DollarSign, UserCheck, ChevronRight } from "lucide-react";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";

interface SearchResult {
  type: "subscriber";
  id: string;
  title: string;
  sub: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

function statusColor(status: string): string {
  if (status === "نشط")         return "#10b981";
  if (status === "ينتهي قريباً") return "#f59e0b";
  if (status === "منتهي")        return "#94a3b8";
  return "#6366f1";
}

export default function GlobalSearch() {
  const router = useRouter();
  const { can } = useAuthStore();
  const { subscribers } = useSubscribers();

  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const inputRef    = useRef<HTMLInputElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const results: SearchResult[] = (() => {
    if (!query.trim() || query.length < 1) return [];
    const q = query.toLowerCase();
    return subscribers
      .filter((s) =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.residence?.toLowerCase().includes(q) ||
        s.package?.includes(q) ||
        s.convincedBy?.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((s) => ({
        type: "subscriber" as const,
        id:   s.id,
        title: s.name,
        sub:  `${s.phone ?? ""} · ${s.residence ?? ""} · ${s.package ?? ""}`,
        href: `/subscribers/${s.id}`,
        badge: s.subscriptionState === "withdrawn" ? "منسحب" : s.status,
        badgeColor: s.subscriptionState === "withdrawn" ? "#f43f5e" : statusColor(s.status),
      }));
  })();

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter" && results[cursor]) go(results[cursor].href);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, cursor, results, go]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface, #fff)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
          border: "1px solid var(--border, rgba(0,0,0,0.08))",
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "var(--border, rgba(0,0,0,0.08))" }}>
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder="ابحث عن مشترك بالاسم أو الهاتف أو الدولة..."
            className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
            style={{ color: "var(--text-primary, #0f172a)" }}
            dir="rtl"
          />
          {query && (
            <button onClick={() => setQuery("")} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15} />
            </button>
          )}
          <kbd className="shrink-0 hidden sm:inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold text-slate-400"
            style={{ borderColor: "var(--border, rgba(0,0,0,0.12))" }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(r.href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors"
                  style={{
                    background: cursor === i ? "var(--surface-2, rgba(0,0,0,0.04))" : "transparent",
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${r.badgeColor}15` }}>
                    <Users size={14} style={{ color: r.badgeColor }} />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary, #0f172a)" }}>
                      {r.title}
                    </p>
                    <p className="text-xs truncate text-slate-400">{r.sub}</p>
                  </div>
                  {r.badge && (
                    <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${r.badgeColor}18`, color: r.badgeColor }}>
                      {r.badge}
                    </span>
                  )}
                  <ChevronRight size={13} className="shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {query.length > 0 && results.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">لا نتائج لـ «{query}»</p>
          </div>
        )}

        {/* Hint footer */}
        {query.length === 0 && (
          <div className="px-4 py-3 flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><kbd className="kbd-hint">↑↓</kbd> تنقل</span>
            <span className="flex items-center gap-1"><kbd className="kbd-hint">Enter</kbd> فتح</span>
            <span className="flex items-center gap-1"><kbd className="kbd-hint">Esc</kbd> إغلاق</span>
          </div>
        )}
      </div>
    </div>
  );
}
