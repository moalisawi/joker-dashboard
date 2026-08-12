"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { X, Scale, ArrowLeft, AlertTriangle, Loader2, Info } from "lucide-react";

import { callSubscriberOperation } from "@/lib/clientOperations";
import { toast } from "@/lib/toast";
import { formatNumber, todayString, formatDate } from "@/lib/utils";
import {
  ADJUSTMENT_TYPES, ADJUSTMENT_TYPE_LABELS, ADJUSTMENT_TYPE_HINTS,
  ADJUSTMENT_APPROVAL_THRESHOLD_USD, type AdjustmentType,
} from "@/constants/billing";
import type { Subscriber, PaymentTransaction } from "@/types";

const ACC = { indigo: "#5B5FEF", emerald: "#22C55E", amber: "#F59E0B", rose: "#EF4444" };

/**
 * Correct money already recorded, without editing the record.
 *
 * The wording throughout is deliberate: this is a *correction*, never an edit.
 * The original payment survives untouched and this writes a second, signed
 * document beside it, so the audit trail shows the mistake and the fix rather
 * than a balance that changed for no visible reason.
 *
 * The direction is a choice the operator makes explicitly rather than by typing
 * a minus sign. "خصم من المدفوع" and "إضافة للمدفوع" cannot be misread; a bare
 * signed number in an Arabic RTL form absolutely can.
 */
export default function AdjustmentModal({
  subscriber, payment, onClose, onSaved,
}: {
  subscriber: Subscriber;
  /** Pre-selected when raised from a specific payment row. */
  payment?: PaymentTransaction | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();

  const [type, setType]         = useState<AdjustmentType>("correction");
  const [direction, setDir]     = useState<"decrease" | "increase">("decrease");
  const [amount, setAmount]     = useState("");
  const [reason, setReason]     = useState("");
  const [notes, setNotes]       = useState("");
  const [date, setDate]         = useState(todayString());
  const [approver, setApprover] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const magnitude = Math.abs(parseFloat(amount) || 0);
  const signed    = direction === "decrease" ? -magnitude : magnitude;

  const paidBefore = subscriber.paidAmountUSD ?? 0;
  const total      = subscriber.totalPriceUSD ?? 0;
  const paidAfter  = paidBefore + signed;
  const remainingAfter = Math.max(0, total - paidAfter);

  // Mirrors the two server guards so the refusal is visible before the round
  // trip rather than as a red banner after it.
  const wouldGoNegative = paidAfter < 0;
  const wouldOverpay    = total > 0 && paidAfter > total + 0.01;
  const needsApprover   = magnitude >= ADJUSTMENT_APPROVAL_THRESHOLD_USD;
  const blocked = !(magnitude > 0) || reason.trim().length < 3 || wouldGoNegative || wouldOverpay;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await callSubscriberOperation("adjustPayment", {
        subscriberId:   subscriber.id,
        paymentId:      payment?.id ?? null,
        adjustmentType: type,
        amountUSD:      signed,
        reason:         reason.trim(),
        notes:          notes.trim() || null,
        date,
        approvedByName: needsApprover ? (approver.trim() || undefined) : undefined,
      });
      toast.success("تم تسجيل التسوية");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تسجيل التسوية");
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
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${ACC.amber}15`, border: `1px solid ${ACC.amber}30`, color: ACC.amber }}
            >
              <Scale size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                تسوية مالية — {subscriber.name}
              </h3>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                لا تُعدَّل الدفعة الأصلية. تُسجَّل تسوية موقّعة بجانبها، ويبقى الاثنان في السجل.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[65vh]">
          {error && (
            <div className="p-3 rounded-xl text-xs" style={{ background: "#EF444410", border: "1px solid #EF444430", color: "#EF4444" }}>
              {error}
            </div>
          )}

          {payment && (
            <div className="rounded-xl p-3 text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-secondary)" }}>
                تسوية على دفعة{" "}
                <b style={{ color: "var(--text-primary)" }}>${formatNumber(payment.amountUSD ?? 0, 2)}</b>
                {payment.date ? ` — ${formatDate(String(payment.date))}` : ""}
                {payment.paymentMethod ? ` · ${payment.paymentMethod}` : ""}
              </p>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>نوع التسوية</label>
            <div className="space-y-1.5">
              {ADJUSTMENT_TYPES.map((t) => {
                const on = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="w-full px-3 py-2 rounded-xl text-right transition-all"
                    style={{
                      background: on ? `${ACC.indigo}12` : "var(--surface-2)",
                      border: `1px solid ${on ? ACC.indigo : "var(--border)"}`,
                      color: on ? ACC.indigo : "var(--text-secondary)",
                    }}
                  >
                    <span className="block text-xs font-bold">{ADJUSTMENT_TYPE_LABELS[t]}</span>
                    <span className="block text-[10px] opacity-70 mt-0.5">{ADJUSTMENT_TYPE_HINTS[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direction + amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الاتجاه</label>
              <select
                value={direction}
                onChange={(e) => setDir(e.target.value as "decrease" | "increase")}
                className="form-input w-full"
              >
                <option value="decrease">خصم من المدفوع</option>
                <option value="increase">إضافة للمدفوع</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>المبلغ (USD)</label>
              <input
                type="number" min="0.01" step="0.01" dir="ltr"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="form-input w-full"
              />
            </div>
          </div>

          {/* Reason — required */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              السبب *
              <span className="mr-1 font-normal opacity-60">(يُحفظ في سجل العمليات)</span>
            </label>
            <input
              type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              maxLength={500} placeholder="مثال: سُجّلت 500 بدل 50 بالخطأ"
              className="form-input w-full"
            />
            {reason.trim().length > 0 && reason.trim().length < 3 && (
              <p className="text-[11px] mt-1" style={{ color: ACC.rose }}>السبب قصير جداً.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input w-full" />
          </div>

          {needsApprover && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                المعتمِد
                <span className="mr-1 font-normal opacity-60">(مبلغ كبير — يُسجَّل اسم المعتمِد)</span>
              </label>
              <input
                type="text" value={approver} onChange={(e) => setApprover(e.target.value)}
                maxLength={200} placeholder="اتركه فارغاً لتسجيل اسمك"
                className="form-input w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000}
              className="form-input resize-none w-full" />
          </div>

          {/* ── Impact ── */}
          {magnitude > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>أثر التسوية</p>

              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>المدفوع</span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <span style={{ color: "var(--text-muted)" }}>${formatNumber(paidBefore, 2)}</span>
                  <ArrowLeft size={11} />
                  <b style={{ color: signed < 0 ? ACC.rose : ACC.emerald }}>${formatNumber(Math.max(0, paidAfter), 2)}</b>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>المتبقي</span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <span style={{ color: "var(--text-muted)" }}>${formatNumber(subscriber.remainingAmountUSD ?? 0, 2)}</span>
                  <ArrowLeft size={11} />
                  <b style={{ color: remainingAfter > 0.01 ? ACC.amber : ACC.emerald }}>${formatNumber(remainingAfter, 2)}</b>
                </span>
              </div>

              {/*
                Instalments are untouched on purpose: writing off $40 does not
                settle instalment #3, and pretending it did would report a
                customer as having paid money nobody received.
              */}
              <p className="flex items-start gap-1.5 text-[11px] pt-1" style={{ color: "var(--text-muted)" }}>
                <Info size={11} className="shrink-0 mt-0.5" />
                جدول الأقساط لا يتأثر — التسوية تصحّح الإجمالي لا الاستحقاقات.
              </p>

              {wouldGoNegative && (
                <p className="flex items-start gap-1.5 text-[11px] font-semibold" style={{ color: ACC.rose }}>
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  التسوية تجعل المدفوع بالسالب. استخدم الاسترداد إذا عادت النقود للعميل فعلاً.
                </p>
              )}
              {wouldOverpay && (
                <p className="flex items-start gap-1.5 text-[11px] font-semibold" style={{ color: ACC.rose }}>
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  التسوية تتجاوز إجمالي الاشتراك (${formatNumber(total, 2)}).
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={save}
            disabled={saving || blocked}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: ACC.amber }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "جارٍ التسجيل…" : "تسجيل التسوية"}
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
