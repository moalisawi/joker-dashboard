"use client";

import { AlertTriangle, Database, Crown, MonitorSmartphone, Loader2 } from "lucide-react";
import type { UserImpact } from "@/lib/userImpact.types";

/**
 * What is attached to an account, shown before anything irreversible happens.
 *
 * Deliberately plain rows rather than cards: this appears inside a confirmation
 * dialog where the reader has one question — "how much am I about to affect?" —
 * and a grid of tiles makes that number harder to find, not easier.
 *
 * A zero row is kept rather than hidden. "٠ محادثات واتساب" is information; a
 * missing line reads as "not checked".
 */
export default function ImpactSummary({
  impact,
  loading,
  error,
}: {
  impact?: UserImpact;
  loading?: boolean;
  error?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={13} className="animate-spin" />
        جارٍ حساب البيانات المرتبطة…
      </div>
    );
  }

  if (error || !impact) {
    return (
      <div
        className="flex items-start gap-2 rounded-xl p-3 text-xs"
        style={{ background: "#F59E0B10", border: "1px solid #F59E0B30", color: "var(--text-secondary)" }}
      >
        <AlertTriangle size={14} style={{ color: "#F59E0B" }} className="shrink-0 mt-0.5" />
        <span>تعذّر حساب البيانات المرتبطة. تابع بحذر — قد تكون هناك سجلات مسندة لهذا الحساب.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <Database size={12} />
          البيانات المرتبطة بالحساب
        </div>

        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {impact.scopes.map((s) => (
            <div key={s.scope} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
              <span
                className="text-xs font-black tabular-nums"
                style={{ color: s.count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {s.count}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <MonitorSmartphone size={12} /> جلسات دخول نشطة
            </span>
            <span className="text-xs font-black tabular-nums" style={{ color: "var(--text-muted)" }}>
              {impact.activeSessions}
            </span>
          </div>
        </div>
      </div>

      {impact.ledTeams.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-xs"
          style={{ background: "#F59E0B10", border: "1px solid #F59E0B30", color: "var(--text-secondary)" }}
        >
          <Crown size={14} style={{ color: "#F59E0B" }} className="shrink-0 mt-0.5" />
          <span>
            يقود {impact.ledTeams.length === 1 ? "فريق" : "فرق"}{" "}
            <b style={{ color: "var(--text-primary)" }}>{impact.ledTeams.map((t) => t.name).join("، ")}</b>{" "}
            — عيّن قائداً بديلاً من صفحة الفرق، فلن يتغيّر تلقائياً.
          </span>
        </div>
      )}

      {/* Stated explicitly so nobody expects payments to move with the transfer. */}
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {impact.historical.payments} دفعة و{impact.historical.auditEntries} سجل عملية تبقى منسوبة لهذا
        الحساب — السجل التاريخي لا يُنقل ولا يُحذف.
        {impact.partial && " (تعذّر إتمام بعض العمليات الحسابية؛ الأرقام قد تكون ناقصة)"}
      </p>
    </div>
  );
}
