"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore }      from "@/store/authStore";
import { useActiveEmployees } from "@/features/users/hooks";
import { useTeams }           from "@/hooks/useTeams";
import { useAssignSubscriber } from "@/hooks/useSubscriberAssignment";
import { canAssignSubscribers, canTransferSubscribers } from "@/lib/permissionGuards";
import {
  ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPE,
  type AssignmentType,
} from "@/constants/subscriberWorkflow";
import type { Subscriber } from "@/types";
import type { AssignmentHistoryEntry } from "@/types";
import { UserCheck, Users2, ChevronDown, Clock, User } from "lucide-react";

// ─── History entry ────────────────────────────────────────────────────────────

function HistoryEntry({ entry }: { entry: AssignmentHistoryEntry }) {
  const name = entry.assignedSalesName ?? entry.assignedNutritionistName ?? entry.assignedTeamName;
  const ts = (() => {
    if (!entry.timestamp) return "";
    try {
      const d = typeof entry.timestamp === "string"
        ? new Date(entry.timestamp)
        : typeof (entry.timestamp as { toDate?(): Date }).toDate === "function"
          ? (entry.timestamp as { toDate(): Date }).toDate()
          : new Date();
      return d.toLocaleDateString("ar-SA", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    } catch { return ""; }
  })();

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "#6366f118", border: "1px solid #6366f128" }}>
        <User size={10} style={{ color: "#6366f1" }}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          {name ? `← ${name}` : ASSIGNMENT_TYPE_LABELS[entry.assignmentType as AssignmentType] ?? entry.assignmentType}
        </p>
        <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <Clock size={9}/>{ts} · {entry.actorName}
        </p>
        {entry.reason && (
          <p className="text-[10px] mt-0.5 italic" style={{ color: "var(--text-secondary)" }}>
            {entry.reason}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  subscriber: Subscriber;
  onSuccess?: (msg: string) => void;
}

export default function AssignmentPanel({ subscriber, onSuccess }: Props) {
  const { user }                           = useAuthStore();
  const { data: employees = [], isLoading} = useActiveEmployees();
  const { data: teams = [] }               = useTeams(true);
  const assignMut                          = useAssignSubscriber();

  const [open, setOpen]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [salesId,    setSalesId]    = useState(subscriber.assignedSalesId    ?? "");
  const [nutritionId,setNutritionId]= useState(subscriber.assignedNutritionistId ?? "");
  const [teamId,     setTeamId]     = useState(subscriber.assignedTeamId     ?? "");
  const [type,       setType]       = useState<AssignmentType>(subscriber.assignmentType ?? ASSIGNMENT_TYPE.UNASSIGNED);
  const [reason,     setReason]     = useState("");
  const [err,        setErr]        = useState("");

  const canAssign   = canAssignSubscribers(user)  || user?.role === "owner" || user?.role === "admin";
  const canTransfer = canTransferSubscribers(user) || user?.role === "owner" || user?.role === "admin";
  const canEdit     = canAssign || canTransfer;

  const salesEmployees     = useMemo(() => employees.filter((e) => e.employeeRole === "sales"),     [employees]);
  const nutritionEmployees = useMemo(() => employees.filter((e) => e.employeeRole === "followup"),  [employees]);

  const history = subscriber.assignmentHistory ?? [];

  const currentLabel = useMemo(() => {
    if (subscriber.assignedSalesName)        return `مبيعات: ${subscriber.assignedSalesName}`;
    if (subscriber.assignedNutritionistName) return `متابعة: ${subscriber.assignedNutritionistName}`;
    if (subscriber.assignedTeamName)         return `فريق: ${subscriber.assignedTeamName}`;
    return ASSIGNMENT_TYPE_LABELS[subscriber.assignmentType ?? ASSIGNMENT_TYPE.UNASSIGNED];
  }, [subscriber]);

  async function handleSave() {
    try {
      setErr("");
      const salesEmp     = salesEmployees.find((e) => e.uid === salesId);
      const nutritionEmp = nutritionEmployees.find((e) => e.uid === nutritionId);
      const teamObj      = teams.find((t) => t.id === teamId);

      await assignMut.mutateAsync({
        subscriberId:             subscriber.id,
        subscriberName:           subscriber.name,
        assignedSalesId:          salesId    || null,
        assignedSalesName:        salesEmp?.name   ?? null,
        assignedNutritionistId:   nutritionId || null,
        assignedNutritionistName: nutritionEmp?.name ?? null,
        assignedTeamId:           teamId     || null,
        assignedTeamName:         teamObj?.name   ?? null,
        assignmentType:           type,
        reason:                   reason || undefined,
      });

      onSuccess?.("تم تحديث التعيين");
      setOpen(false);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <UserCheck size={15} style={{ color: "#6366f1" }}/>
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>التعيين</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={() => setShowHistory((v) => !v)}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
              style={{ background: "#6366f110", color: "#6366f1" }}>
              السجل ({history.length})
            </button>
          )}
          {canEdit && (
            <button onClick={() => setOpen((v) => !v)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              {open ? "إغلاق" : "تعديل"}
            </button>
          )}
        </div>
      </div>

      {/* Current assignment summary */}
      <div className="px-5 py-3">
        <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>الحالة الحالية</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: "#6366f112", color: "#6366f1", border: "1px solid #6366f128" }}>
            <UserCheck size={11}/>{currentLabel}
          </span>
          {subscriber.assignedTeamName && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: "#10b98112", color: "#10b981", border: "1px solid #10b98128" }}>
              <Users2 size={11}/>{subscriber.assignedTeamName}
            </span>
          )}
        </div>
      </div>

      {/* Edit form */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="overflow-hidden border-t" style={{ borderColor: "var(--border)" }}
          >
            <div className="px-5 py-4 space-y-3">
              {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{err}</div>}

              {/* Assignment type */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>نوع التعيين</label>
                <select value={type} onChange={(e) => setType(e.target.value as AssignmentType)} className="form-input text-sm">
                  {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Sales employee */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>موظف مبيعات</label>
                  <select value={salesId} onChange={(e) => setSalesId(e.target.value)} className="form-input text-sm">
                    <option value="">— بدون —</option>
                    {isLoading ? null : salesEmployees.map((e) => <option key={e.uid} value={e.uid}>{e.name}</option>)}
                  </select>
                </div>

                {/* Nutrition employee */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>موظف متابعة</label>
                  <select value={nutritionId} onChange={(e) => setNutritionId(e.target.value)} className="form-input text-sm">
                    <option value="">— بدون —</option>
                    {nutritionEmployees.map((e) => <option key={e.uid} value={e.uid}>{e.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Team */}
              {teams.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الفريق</label>
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="form-input text-sm">
                    <option value="">— بدون فريق —</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>سبب التغيير (اختياري)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)}
                  className="form-input text-sm" placeholder="مثال: نقل بناءً على طلب العميل"/>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={assignMut.isPending}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-xs disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {assignMut.isPending ? "جاري..." : "حفظ التعيين"}
                </button>
                <button onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>إلغاء</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="border-t px-5 py-3 overflow-hidden divide-y"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Clock size={11}/> سجل التعيينات
            </p>
            {[...history].reverse().map((entry, i) => (
              <HistoryEntry key={i} entry={entry}/>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
