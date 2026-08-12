"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Scale, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { formatNumber, todayString } from "@/lib/utils";
import { addDays } from "@/lib/subscriberFinance";

interface Summary {
  paymentCount: number;
  expectedTotalUSD: number;
  actualTotalUSD: number;
  differenceUSD: number;
  alreadyReconciled: number;
}

async function post(body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized");
  const res = await fetch("/api/payments/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error ?? "فشلت المطابقة");
  return data;
}

/**
 * Reconcile one payment method against what actually landed.
 *
 * The preview runs first and unprompted: the operator sees how many payments
 * fall in the window and what the system expects *before* typing what the
 * statement says, so the comparison is between two independently-arrived-at
 * numbers rather than one anchored on the other.
 *
 * A non-zero difference does not block the save. It is the finding — a bounced
 * transfer, a fee taken at the far end, a double entry — and refusing to record
 * it would push the discrepancy back into a spreadsheet, which is what this
 * exists to end. The batch is stored `disputed` and the button says so.
 */
export default function ReconcileModal({
  paymentMethodId, paymentMethodName, onClose,
}: {
  paymentMethodId: string;
  paymentMethodName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const today = todayString();

  const [periodStart, setPeriodStart] = useState(addDays(today, -30));
  const [periodEnd, setPeriodEnd]     = useState(today);
  const [actual, setActual]           = useState("");
  const [notes, setNotes]             = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /*
   * The preview is a query, not an effect.
   *
   * The expected total is a pure function of (method, period) — exactly what a
   * cache key is for. Fetching it in a useEffect meant hand-rolling the
   * cancelled-request flag, the loading flag and the error state, and calling
   * setState synchronously in the effect body, which cascades a render on every
   * date change. React Query keys on the window instead, so moving the dates
   * re-fetches and a stale total can never sit beside a new date range.
   */
  const preview = useQuery({
    queryKey: ["reconcile-preview", paymentMethodId, periodStart, periodEnd],
    enabled: Boolean(periodStart && periodEnd && periodStart <= periodEnd),
    staleTime: 15_000,
    retry: false,
    queryFn: () => post({ paymentMethodId, periodStart, periodEnd, preview: true }) as Promise<Summary>,
  });

  const summary = preview.data ?? null;
  const loading = preview.isLoading;
  const error = saveError || (preview.error instanceof Error ? preview.error.message : "");

  const actualNum = actual.trim() === "" ? null : Number(actual);
  const difference = summary && actualNum !== null ? actualNum - summary.expectedTotalUSD : 0;
  const matches = Math.abs(difference) < 0.01;

  async function save() {
    if (!summary || summary.paymentCount === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await post({
        paymentMethodId,
        paymentMethodName,
        periodStart,
        periodEnd,
        ...(actualNum !== null ? { actualTotalUSD: actualNum } : {}),
        notes: notes.trim() || null,
      });
      toast.success(
        res.status === "reconciled"
          ? `تمت مطابقة ${res.paymentCount} دفعة`
          : `سُجّلت المطابقة بفارق $${Number(res.differenceUSD).toFixed(2)}`
      );
      qc.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "فشلت المطابقة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Scale size={16} style={{ color: "#5B5FEF" }} />
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
              مطابقة — {paymentMethodName}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-xs" style={{ background: "#EF444410", border: "1px solid #EF444430", color: "#EF4444" }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>من</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="form-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>إلى</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="form-input w-full" />
            </div>
          </div>

          {/* ── What the system expects ── */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            {loading ? (
              <p className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <Loader2 size={12} className="animate-spin" /> جارٍ الحساب…
              </p>
            ) : summary ? (
              <>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>دفعات غير مطابَقة في الفترة</span>
                  <b className="tabular-nums" style={{ color: "var(--text-primary)" }}>{summary.paymentCount}</b>
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>الإجمالي المتوقَّع</span>
                  <b className="tabular-nums" style={{ color: "#22C55E" }}>${formatNumber(summary.expectedTotalUSD, 2)}</b>
                </div>
                {summary.alreadyReconciled > 0 && (
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {summary.alreadyReconciled} دفعة في هذه الفترة مطابَقة سابقاً ومستثناة من الحساب.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>لا توجد بيانات لهذه الفترة.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              الإجمالي الفعلي من كشف الحساب (USD)
              <span className="mr-1 font-normal opacity-60">(اتركه فارغاً إذا مطابق)</span>
            </label>
            <input
              type="number" step="0.01" dir="ltr" value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder={summary ? String(summary.expectedTotalUSD.toFixed(2)) : ""}
              className="form-input w-full"
            />
          </div>

          {summary && actualNum !== null && (
            <div
              className="flex items-start gap-2 rounded-xl p-3 text-xs"
              style={{
                background: matches ? "#22C55E10" : "#F59E0B10",
                border: `1px solid ${matches ? "#22C55E" : "#F59E0B"}30`,
                color: "var(--text-secondary)",
              }}
            >
              {matches
                ? <CheckCircle2 size={14} style={{ color: "#22C55E" }} className="shrink-0 mt-0.5" />
                : <AlertTriangle size={14} style={{ color: "#F59E0B" }} className="shrink-0 mt-0.5" />}
              <span>
                {matches
                  ? "مطابق تماماً — ستُسجَّل الدفعات كمطابَقة."
                  : <>فرق <b style={{ color: "#F59E0B" }}>${formatNumber(Math.abs(difference), 2)}</b>{" "}
                     {difference > 0 ? "زيادة عن المسجَّل" : "نقص عن المسجَّل"} — ستُسجَّل الدفعة كمتنازع عليها للمراجعة.</>}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000}
              className="form-input resize-none w-full" placeholder="مرجع كشف الحساب، سبب الفرق…" />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={save}
            disabled={saving || loading || !summary || summary.paymentCount === 0}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: matches || actualNum === null ? "#5B5FEF" : "#F59E0B" }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "جارٍ الحفظ…" : matches || actualNum === null ? "تأكيد المطابقة" : "تسجيل الفرق"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}
