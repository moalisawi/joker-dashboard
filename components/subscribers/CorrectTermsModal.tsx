"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

import type { Subscriber } from "@/types";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { useAuthStore } from "@/store/authStore";
import { MIN_REASON_LENGTH } from "@/lib/cycleTermsCorrection";

/**
 * Correcting terms that were typed wrong when the subscription was sold.
 *
 * Deliberately not part of "تعديل بيانات المشترك". That dialog is for who the
 * person is; this is for what they bought, and the two being one form is what
 * let a price be rewritten as casually as a phone number. Reaching this needs a
 * separate, differently-worded, differently-coloured door.
 *
 * The server decides. Everything here — the owner/admin gate, the required
 * reason, the field list — is a second copy of a rule enforced in
 * `correctCycleTerms`, so a stale tab or a direct call is refused just the same.
 * The point of repeating it is that a refusal after typing is a worse experience
 * than a form that never offered the impossible.
 */

interface Props {
  subscriber: Subscriber;
  onClose: () => void;
  onSaved: () => void;
}

type Field = "totalPriceOriginal" | "currencyOriginal" | "lockedRate" | "duration" | "package";

const FIELDS: { key: Field; label: string; hint: string; kind: "number" | "text" }[] = [
  { key: "totalPriceOriginal", label: "السعر الكلي", hint: "بعملة الاشتراك", kind: "number" },
  { key: "currencyOriginal",   label: "العملة",      hint: "يُرفض بعد أي دفعة", kind: "text" },
  { key: "lockedRate",         label: "سعر الصرف",   hint: "يُرفض بعد أي دفعة", kind: "number" },
  { key: "duration",           label: "المدة (يوم)", hint: "يعيد حساب تاريخ الانتهاء", kind: "number" },
  { key: "package",            label: "الباقة",      hint: "تسمية فقط", kind: "text" },
];

export default function CorrectTermsModal({ subscriber, onClose, onSaved }: Props) {
  const { user } = useAuthStore();
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentOf = (f: Field): string => {
    if (f === "totalPriceOriginal") return String(subscriber.totalPrice ?? "");
    if (f === "currencyOriginal")   return String(subscriber.currencyOriginal ?? "");
    if (f === "lockedRate")         return String(subscriber.lockedRate ?? "");
    if (f === "duration")           return String(subscriber.duration ?? "");
    return String(subscriber.package ?? "");
  };

  // Only fields the operator actually filled in, and only where they differ.
  const changes = FIELDS.reduce<Record<string, string | number>>((acc, f) => {
    const raw = (values[f.key] ?? "").trim();
    if (raw === "" || raw === currentOf(f.key)) return acc;
    acc[f.key] = f.kind === "number" ? Number(raw) : raw;
    return acc;
  }, {});

  const changeCount = Object.keys(changes).length;
  const canSubmit = changeCount > 0 && reason.trim().length >= MIN_REASON_LENGTH && !saving;

  // The server enforces this; showing it is what stops a salesperson typing a
  // correction into a box that was always going to refuse them.
  if (user?.role !== "owner" && user?.role !== "admin") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldAlert size={18} style={{ color: "#B02727" }} />
            <h2 className="text-[16px] font-extrabold">تصحيح شروط الدورة</h2>
          </div>
          <p className="text-[13.5px]" style={{ color: "var(--jk-subtle)" }}>
            هذه العملية للمالك والمدير فقط. تصحيح شروط بيع يعيد كتابة ما تمّت فوترته، وهو قرار مالي مدقَّق.
          </p>
          <button type="button" className="btn-secondary mt-5 w-full" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    );
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await callSubscriberOperation("correctCycleTerms", {
        subscriberId: subscriber.id,
        cycleId: subscriber.currentCycleId ?? null,
        changes,
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التصحيح");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel max-w-lg w-full flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--jk-divider)" }}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} style={{ color: "#B02727" }} />
            <h2 className="text-[16px] font-extrabold" style={{ color: "var(--jk-text)" }}>
              تصحيح شروط الدورة
            </h2>
          </div>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--jk-subtle)" }}>
            {subscriber.name} — لتصحيح ما أُدخل خطأً عند البيع، لا لتغيير ما اتُّفق عليه.
            <b style={{ color: "var(--jk-text)" }}> التغيير الحقيقي للباقة أو المدة تجديد، لا تصحيح.</b>
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex flex-col gap-3.5">
          <div
            className="text-[12.5px] leading-relaxed px-3.5 py-3 rounded-xl"
            style={{ background: "rgba(176,43,43,0.07)", border: "1px solid rgba(176,43,43,0.25)", color: "var(--jk-text)" }}
          >
            كل تصحيح <b>يُسجَّل باسمك</b> مع القيمة قبله وبعده وسببه. لا تُعدَّل الدفعات ولا المستردّات —
            تبقى وقائع تاريخية كما سُجّلت. وقد يرفض النظام التصحيح إن وُجدت أقساط أو دفعات أو استرداد.
          </div>

          {FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
              <div className="min-w-0">
                <p className="text-[12px] font-bold" style={{ color: "var(--jk-text)" }}>{f.label}</p>
                <p className="text-[11px]" style={{ color: "var(--jk-subtle)" }}>{f.hint}</p>
              </div>
              <span className="text-[12px] tabular-nums px-2.5 py-1.5 rounded-lg"
                style={{ background: "var(--jk-surface-hover)", color: "var(--jk-subtle)", minWidth: 76, textAlign: "center" }}>
                {currentOf(f.key) || "—"}
              </span>
              <input
                className="form-input"
                type={f.kind === "number" ? "number" : "text"}
                placeholder="القيمة الصحيحة"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          <div>
            <p className="text-[12px] font-bold mb-1" style={{ color: "var(--jk-text)" }}>
              سبب التصحيح * <span style={{ color: "var(--jk-subtle)", fontWeight: 500 }}>
                (لا يقل عن {MIN_REASON_LENGTH} أحرف)
              </span>
            </p>
            <textarea
              className="form-input"
              rows={2}
              placeholder="مثال: السعر أُدخل ٥٠٠ بدل ٥٠ عند التسجيل"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-[12.5px] leading-relaxed px-3.5 py-3 rounded-xl"
              style={{ background: "rgba(176,43,43,0.09)", color: "#B02727" }}>
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 flex gap-2.5" style={{ borderTop: "1px solid var(--jk-divider)" }}>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!canSubmit}
            style={{ background: canSubmit ? "#B02727" : undefined, opacity: canSubmit ? 1 : 0.5 }}
            onClick={submit}
          >
            {saving ? "جارٍ التصحيح…" : `تأكيد تصحيح ${changeCount || ""} ${changeCount ? "حقل" : "الشروط"}`}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
