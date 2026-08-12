"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  X, UserMinus, UserCheck, Archive, ArrowLeftRight, AlertTriangle, Loader2,
} from "lucide-react";

import ImpactSummary from "@/components/employees/ImpactSummary";
import {
  useUserImpact, useDeactivateEmployee, useReactivateEmployee,
  useArchiveEmployee, useTransferData,
} from "@/features/users/hooks";
import { SCOPE_META, TRANSFER_SCOPES, type TransferScope } from "@/constants/transferScopes";
import {
  UserOperationError, type AccessRevocationResult,
} from "@/features/users/services/users.service";
import { toast } from "@/lib/toast";
import type { UserProfile } from "@/types";

export type LifecycleAction = "deactivate" | "reactivate" | "archive" | "transfer";

const META: Record<LifecycleAction, {
  title: string; icon: React.ReactNode; accent: string; confirm: string; blurb: string;
}> = {
  deactivate: {
    title: "تعطيل الحساب",
    icon: <UserMinus size={16} />,
    accent: "#F59E0B",
    confirm: "تعطيل الحساب",
    blurb: "يفقد الوصول فوراً وتُلغى جلساته المفتوحة. لا يُحذف شيء، ويمكن إعادة التفعيل في أي وقت.",
  },
  reactivate: {
    title: "إعادة تفعيل الحساب",
    icon: <UserCheck size={16} />,
    accent: "#5B5FEF",
    confirm: "إعادة التفعيل",
    blurb: "يستعيد الوصول وفق صلاحياته المحفوظة، وتعود بياناته المرتبطة كما كانت.",
  },
  archive: {
    title: "أرشفة الحساب",
    icon: <Archive size={16} />,
    accent: "#EF4444",
    confirm: "أرشفة الحساب",
    blurb: "يُغلق الحساب نهائياً من ناحية الاستخدام، لكن سجله يبقى — الاسم يظل ظاهراً على كل مشترك ودفعة سابقة.",
  },
  transfer: {
    title: "نقل البيانات المرتبطة",
    icon: <ArrowLeftRight size={16} />,
    accent: "#3B82F6",
    confirm: "تنفيذ النقل",
    blurb: "تُسند السجلات المختارة لموظف آخر. المدفوعات والسجلات التاريخية لا تتأثر.",
  },
};

/**
 * The four lifecycle actions, each behind the same dialog.
 *
 * They were four different confirmations in three different files, and the one
 * thing none of them did was say what the action would touch. Here every one
 * loads the impact summary first, and the two destructive ones refuse to submit
 * until the assigned work has somewhere to go — either a named recipient or an
 * explicit acknowledgement that it stays attached to a closed account.
 */
export default function LifecycleModal({
  action,
  employee,
  recipients,
  onClose,
  onDone,
}: {
  action: LifecycleAction;
  employee: UserProfile;
  /** Active accounts that may receive transferred work. */
  recipients: UserProfile[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const meta = META[action];
  const needsImpact = action !== "reactivate";

  const {
    data: impact, isLoading: impactLoading, isError: impactError, refetch: refetchImpact,
  } = useUserImpact(employee.uid, needsImpact);

  const deactivateMut = useDeactivateEmployee();
  const reactivateMut = useReactivateEmployee();
  const archiveMut    = useArchiveEmployee();
  const transferMut   = useTransferData();

  const [reason, setReason]           = useState("");
  const [transferOn, setTransferOn]   = useState(action === "transfer");
  const [toUid, setToUid]             = useState("");
  const [keepAssignments, setKeep]    = useState(false);
  const [scopes, setScopes]           = useState<TransferScope[] | null>(null);
  const [serverRefusal, setServerRefusal] = useState<string | null>(null);

  // Default to the scopes that actually hold something. Pre-ticking empty ones
  // makes the dialog look like it will do more than it will.
  const selectedScopes = useMemo<TransferScope[]>(() => {
    if (scopes) return scopes;
    if (!impact) return [];
    return impact.scopes.filter((s) => s.count > 0).map((s) => s.scope);
  }, [scopes, impact]);

  const eligible = useMemo(
    () => recipients.filter((r) => r.uid !== employee.uid && r.active && !r.deleted),
    [recipients, employee.uid]
  );

  const attached      = impact?.transferableTotal ?? 0;
  const pending       = deactivateMut.isPending || reactivateMut.isPending
                     || archiveMut.isPending || transferMut.isPending;

  const transferReady = Boolean(toUid) && selectedScopes.length > 0;
  const blocked =
    action === "transfer"
      ? !transferReady
      : action === "archive"
        ? attached > 0 && !(transferOn && transferReady) && !keepAssignments
        : false;

  function toggleScope(scope: TransferScope) {
    const next = selectedScopes.includes(scope)
      ? selectedScopes.filter((s) => s !== scope)
      : [...selectedScopes, scope];
    setScopes(next);
  }

  /**
   * The Firestore state is already correct when these come back; a false flag
   * means the Firebase Auth side needs a human. Silently toasting "تم التعطيل"
   * over a live session that was never revoked is the one outcome this dialog
   * must not produce.
   */
  function reportAccess(res: AccessRevocationResult | undefined, successMessage: string) {
    if (res?.authEnabled === false) {
      toast.warning("تم التفعيل في النظام، لكن تعذّر تمكين حساب الدخول — أعد المحاولة أو فعّله من Firebase.");
      return;
    }
    if (res?.needsAttention) {
      toast.warning(
        !res.tokensRevoked
          ? "تم التعطيل، لكن تعذّر إنهاء الجلسات المفتوحة — قد يبقى الوصول فعّالاً حتى ساعة."
          : "تم التعطيل في النظام، لكن تعذّر تعطيل حساب الدخول — راجع Firebase."
      );
      return;
    }
    toast.success(successMessage);
  }

  async function submit() {
    const transferPayload = transferOn && transferReady
      ? { transferToUid: toUid, transferScopes: selectedScopes }
      : {};

    try {
      if (action === "deactivate") {
        const res = await deactivateMut.mutateAsync({
          uid: employee.uid, reason: reason || undefined, ...transferPayload,
        });
        reportAccess(res, "تم تعطيل الحساب");
      } else if (action === "reactivate") {
        const res = await reactivateMut.mutateAsync({ uid: employee.uid, reason: reason || undefined });
        reportAccess(res, "تم تفعيل الحساب");
      } else if (action === "archive") {
        const res = await archiveMut.mutateAsync({
          uid: employee.uid,
          reason: reason || undefined,
          // The server re-counts after any transfer and refuses on a non-zero
          // remainder unless this is set, so passing the checkbox as-is is
          // correct: a transfer that clears everything leaves nothing to consent to.
          keepAssignments,
          ...transferPayload,
        });
        reportAccess(res, "تمت أرشفة الحساب");
        if (res?.clearedTeamLeadership?.length) {
          toast.warning(`أصبح بلا قائد: ${res.clearedTeamLeadership.join("، ")} — عيّن قائداً من صفحة الفرق.`);
        }
      } else {
        const res = await transferMut.mutateAsync({
          fromUid: employee.uid,
          toUid,
          scopes: selectedScopes,
          reason: reason || undefined,
        });
        toast.success(`تم نقل ${res.total} سجلاً`);
      }
      onDone?.();
      onClose();
    } catch (e) {
      // The account gained assignments between opening this dialog and
      // submitting it. Recoverable: refresh the counts so the transfer controls
      // and the acknowledgement reappear, and keep the dialog open.
      if (e instanceof UserOperationError && e.code === "ASSIGNMENTS_PENDING") {
        setServerRefusal(e.message);
        setTransferOn(true);
        refetchImpact();
        return;
      }
      toast.error(e instanceof Error ? e.message : "فشل تنفيذ العملية");
    }
  }

  const showTransferBlock = action === "transfer" || (attached > 0 && action !== "reactivate");

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${meta.accent}15`, border: `1px solid ${meta.accent}30`, color: meta.accent }}
            >
              {meta.icon}
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                {meta.title} — {employee.name}
              </h3>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {meta.blurb}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[65vh]">
          {serverRefusal && (
            <div
              className="flex items-start gap-2 rounded-xl p-3 text-xs"
              style={{ background: "#EF444410", border: "1px solid #EF444430", color: "var(--text-secondary)" }}
            >
              <AlertTriangle size={14} style={{ color: "#EF4444" }} className="shrink-0 mt-0.5" />
              <span>
                {serverRefusal}
                <span className="block mt-1 opacity-80">
                  تغيّرت البيانات المرتبطة منذ فتح هذه النافذة — الأرقام أدناه محدّثة.
                </span>
              </span>
            </div>
          )}

          {needsImpact && (
            <ImpactSummary impact={impact} loading={impactLoading} error={impactError} />
          )}

          {/* ── Transfer ── */}
          {showTransferBlock && (
            <div className="rounded-xl p-3 space-y-3" style={{ border: "1px solid var(--border)" }}>
              {action !== "transfer" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferOn}
                    onChange={(e) => setTransferOn(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500"
                  />
                  <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    نقل البيانات المرتبطة إلى موظف آخر أولاً
                  </span>
                </label>
              )}

              {transferOn && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      المستلم
                    </label>
                    <select value={toUid} onChange={(e) => setToUid(e.target.value)} className="form-input text-sm">
                      <option value="">— اختر موظفاً نشطاً —</option>
                      {eligible.map((r) => (
                        <option key={r.uid} value={r.uid}>{r.name} — {r.email}</option>
                      ))}
                    </select>
                    {eligible.length === 0 && (
                      <p className="text-[11px] mt-1" style={{ color: "#F59E0B" }}>
                        لا يوجد حساب نشط آخر يمكن النقل إليه.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {TRANSFER_SCOPES.map((scope) => {
                      const count = impact?.scopes.find((s) => s.scope === scope)?.count ?? 0;
                      const on    = selectedScopes.includes(scope);
                      return (
                        <label
                          key={scope}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer"
                          style={{
                            background: on ? "#5B5FEF10" : "transparent",
                            border: `1px solid ${on ? "#5B5FEF30" : "var(--border)"}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleScope(scope)}
                            className="w-3.5 h-3.5 accent-indigo-500 shrink-0"
                          />
                          <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
                            {SCOPE_META[scope].label}
                            <span className="block text-[10px] opacity-70">{SCOPE_META[scope].hint}</span>
                          </span>
                          <span className="text-xs font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Orphan acknowledgement ── */}
          {action === "archive" && attached > 0 && !(transferOn && transferReady) && (
            <label
              className="flex items-start gap-2 rounded-xl p-3 cursor-pointer"
              style={{ background: "#EF444408", border: "1px solid #EF444430" }}
            >
              <input
                type="checkbox"
                checked={keepAssignments}
                onChange={(e) => setKeep(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-500 shrink-0 mt-0.5"
              />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                أفهم أن <b style={{ color: "var(--text-primary)" }}>{attached}</b> سجلاً ستبقى مسندة لحساب
                مؤرشف ولن تظهر في قوائم عمل أي موظف نشط.
              </span>
            </label>
          )}

          {/* ── Reason ── */}
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              السبب <span className="font-normal opacity-60">(يُسجَّل في سجل العمليات)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              className="form-input resize-none text-sm"
              placeholder="اختياري…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={submit}
            disabled={pending || blocked}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: meta.accent }}
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? "جارٍ التنفيذ…" : meta.confirm}
          </button>
          <button
            onClick={onClose}
            disabled={pending}
            className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            إلغاء
          </button>
        </div>

        {blocked && (
          <p
            className="flex items-center gap-1.5 px-5 pb-4 text-[11px]"
            style={{ color: "#F59E0B" }}
          >
            <AlertTriangle size={12} />
            {action === "transfer"
              ? "اختر المستلم ونوع البيانات لتفعيل النقل."
              : "انقل البيانات المرتبطة أو أكّد الاحتفاظ بها للمتابعة."}
          </p>
        )}
      </motion.div>
    </div>
  );
}
