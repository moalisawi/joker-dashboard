"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore }         from "@/store/authStore";
import { useActiveEmployees }   from "@/features/users/hooks";
import { useTeams }             from "@/hooks/useTeams";
import { useAssignSubscriber, useUnassignSubscriber } from "@/features/subscriberAssignments";
import { useAssignmentHistory } from "@/features/subscriberAssignments";
import {
  canAssignSubscribers, canTransferSubscribers,
} from "@/lib/permissionGuards";
import {
  ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPE,
  WORKFLOW_LABELS, WORKFLOW_COLORS,
  type AssignmentType,
} from "@/constants/subscriberWorkflow";
import WorkflowStatusPanel from "@/components/subscribers/WorkflowStatusPanel";
import type { Subscriber } from "@/types";
import type { SubscriberAssignmentRecord } from "@/features/subscriberAssignments";
import {
  UserCheck, Users2, Clock, ArrowLeft, ArrowRight,
  User, RotateCcw, AlertTriangle, Check,
} from "lucide-react";
import EmployeeNameChip from "@/components/employees/EmployeeNameChip";

const ACC = { indigo:"#83A2DB", emerald:"#83A2DB", amber:"#E8B570", rose:"#CE6969" };
const fadeUp = { hidden:{opacity:0,y:10}, show:{opacity:1,y:0} };
const tran   = { duration:0.28, ease:"easeOut" } as const;
const stagger = { show:{transition:{staggerChildren:0.04}} };

function formatTs(ts: unknown): string {
  if (!ts) return "";
  try {
    const d = typeof ts === "string"
      ? new Date(ts)
      : typeof (ts as {toDate?():Date}).toDate === "function"
        ? (ts as {toDate():Date}).toDate()
        : new Date();
    return d.toLocaleDateString("ar-SA", {
      day:"numeric", month:"short", year:"numeric",
      hour:"2-digit", minute:"2-digit",
    });
  } catch { return ""; }
}

function HistoryCard({ rec }: { rec: SubscriberAssignmentRecord }) {
  const from = rec.fromEmployeeName ?? rec.fromTeamName ?? ASSIGNMENT_TYPE_LABELS[rec.fromAssignmentType ?? ASSIGNMENT_TYPE.UNASSIGNED];
  const to   = rec.toEmployeeName   ?? rec.toTeamName   ?? ASSIGNMENT_TYPE_LABELS[rec.toAssignmentType];
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0"
      style={{ borderColor:"var(--divider)" }}>
      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background:`${ACC.indigo}15`, border:`1px solid ${ACC.indigo}28` }}>
        <User size={11} style={{ color:ACC.indigo }}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold mb-0.5"
          style={{ color:"var(--text-primary)" }}>
          <span style={{ color:"var(--text-muted)" }}>{from}</span>
          <ArrowLeft size={12} style={{ color:"var(--text-muted)" }}/>
          <span style={{ color:ACC.indigo }}>{to}</span>
        </div>
        {rec.reason && (
          <p className="text-[11px] italic mb-0.5" style={{ color:"var(--text-secondary)" }}>
            "{rec.reason}"
          </p>
        )}
        <p className="text-[10px] flex items-center gap-1" style={{ color:"var(--text-muted)" }}>
          <Clock size={9}/>{formatTs(rec.createdAt)} · {rec.transferredByName}
        </p>
      </div>
    </div>
  );
}

interface UnassignConfirmProps {
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function UnassignConfirm({ onConfirm, onCancel, isPending }: UnassignConfirmProps) {
  return (
    <motion.div
      initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }}
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background:`${ACC.rose}08`, border:`1px solid ${ACC.rose}28` }}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} style={{ color:ACC.rose }}/>
        <p className="text-sm font-semibold" style={{ color:ACC.rose }}>إلغاء جميع التعيينات؟</p>
      </div>
      <p className="text-xs" style={{ color:"var(--text-secondary)" }}>
        سيتم إزالة المبيعات والمتابعة والفريق من هذا المشترك.
      </p>
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={isPending}
          className="flex-1 py-2 rounded-xl text-white font-bold text-xs disabled:opacity-60"
          style={{ background:ACC.rose }}>
          {isPending ? "جاري..." : "تأكيد الإلغاء"}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl border text-xs font-semibold"
          style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>
          إلغاء
        </button>
      </div>
    </motion.div>
  );
}

interface Props {
  subscriber: Subscriber;
}

export default function AssignmentsTab({ subscriber }: Props) {
  const { user }                           = useAuthStore();
  const { data: employees = [], isLoading} = useActiveEmployees();
  const { data: _allTeams = [] }           = useTeams(false);
  const teams                              = _allTeams.filter(t => t.active !== false);
  const assignMut                          = useAssignSubscriber();
  const unassignMut                        = useUnassignSubscriber();
  const { data: history = [], isLoading: histLoading } = useAssignmentHistory(subscriber.id);

  const [editOpen, setEditOpen]           = useState(false);
  const [confirmUnassign, setConfirm]     = useState(false);
  const [salesId, setSalesId]             = useState(subscriber.assignedSalesId ?? "");
  const [nutritionId, setNutritionId]     = useState(subscriber.assignedNutritionistId ?? "");
  const [teamId, setTeamId]               = useState(subscriber.assignedTeamId ?? "");
  const [type, setType]                   = useState<AssignmentType>(
    subscriber.assignmentType ?? ASSIGNMENT_TYPE.UNASSIGNED
  );
  const [reason, setReason]               = useState("");
  const [err, setErr]                     = useState("");
  const [success, setSuccess]             = useState("");

  const canAssign   = canAssignSubscribers(user)  || user?.role === "owner" || user?.role === "admin";
  const canTransfer = canTransferSubscribers(user) || user?.role === "owner" || user?.role === "admin";
  const canEdit     = canAssign || canTransfer;

  const salesEmployees     = useMemo(() => employees.filter((e) => e.employeeRole === "sales"),    [employees]);
  const nutritionEmployees = useMemo(() => employees.filter((e) => e.employeeRole === "followup"), [employees]);

  const isAssigned = !!(
    subscriber.assignedSalesId ||
    subscriber.assignedNutritionistId ||
    subscriber.assignedTeamId
  );

  async function handleSave() {
    try {
      setErr(""); setSuccess("");
      const salesEmp     = salesEmployees.find((e) => e.uid === salesId);
      const nutritionEmp = nutritionEmployees.find((e) => e.uid === nutritionId);
      const teamObj      = teams.find((t) => t.id === teamId);

      await assignMut.mutateAsync({
        subscriberId:             subscriber.id,
        subscriberName:           subscriber.name,
        assignedSalesId:          salesId     || null,
        assignedSalesName:        salesEmp?.name    ?? null,
        assignedNutritionistId:   nutritionId  || null,
        assignedNutritionistName: nutritionEmp?.name ?? null,
        assignedTeamId:           teamId      || null,
        assignedTeamName:         teamObj?.name     ?? null,
        assignmentType:           type,
        reason:                   reason || undefined,
      });
      setEditOpen(false); setReason("");
      setSuccess("تم تحديث التعيين بنجاح");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  async function handleUnassign() {
    try {
      setErr("");
      await unassignMut.mutateAsync({
        subscriberId:   subscriber.id,
        subscriberName: subscriber.name,
      });
      setConfirm(false);
      setSuccess("تم إلغاء التعيين");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

      {/* ── Workflow status ── */}
      <motion.div variants={fadeUp} transition={tran}>
        <WorkflowStatusPanel subscriber={subscriber} onSuccess={(msg) => { setSuccess(msg); setTimeout(()=>setSuccess(""),3000); }}/>
      </motion.div>

      {/* ── Current assignment card ── */}
      <motion.div variants={fadeUp}
        className="rounded-2xl overflow-hidden"
        style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <UserCheck size={15} style={{ color:ACC.indigo }}/>
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>التعيين الحالي</span>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {isAssigned && !confirmUnassign && (
                <button onClick={() => setConfirm(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                  style={{ background:`${ACC.rose}12`, color:ACC.rose, border:`1px solid ${ACC.rose}28` }}>
                  إلغاء التعيين
                </button>
              )}
              <button onClick={() => { setEditOpen((v)=>!v); setConfirm(false); }}
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all"
                style={{ background:"linear-gradient(135deg,#83A2DB,#9DB4D6)" }}>
                {editOpen ? "إغلاق" : "تعديل"}
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {success && (
            <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold"
              style={{ background:`${ACC.emerald}12`, color:ACC.emerald, border:`1px solid ${ACC.emerald}25` }}>
              <Check size={13}/>{success}
            </div>
          )}
          {err && (
            <div className="mb-3 p-2.5 rounded-xl text-xs" style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#CE6969" }}>
              {err}
            </div>
          )}

          {/* Assignment badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {subscriber.assignedSalesName ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background:`${ACC.emerald}12`, color:ACC.emerald, border:`1px solid ${ACC.emerald}28` }}>
                <UserCheck size={11}/>مبيعات:{" "}
                <EmployeeNameChip
                  name={subscriber.assignedSalesName}
                  uid={subscriber.assignedSalesId}
                  style={{ color: ACC.emerald, fontWeight: 700 }}
                />
              </span>
            ) : null}
            {subscriber.assignedNutritionistName ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background:`${ACC.indigo}12`, color:ACC.indigo, border:`1px solid ${ACC.indigo}28` }}>
                <User size={11}/>متابعة:{" "}
                <EmployeeNameChip
                  name={subscriber.assignedNutritionistName}
                  uid={subscriber.assignedNutritionistId}
                  style={{ color: ACC.indigo, fontWeight: 700 }}
                />
              </span>
            ) : null}
            {subscriber.assignedTeamName ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background:`${ACC.amber}12`, color:ACC.amber, border:`1px solid ${ACC.amber}28` }}>
                <Users2 size={11}/>فريق: {subscriber.assignedTeamName}
              </span>
            ) : null}
            {!isAssigned && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background:"var(--surface-2)", color:"var(--text-muted)", border:"1px solid var(--border)" }}>
                غير معيّن
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{ background:"var(--surface-2)", color:"var(--text-secondary)", border:"1px solid var(--border)" }}>
              النوع: {ASSIGNMENT_TYPE_LABELS[subscriber.assignmentType ?? ASSIGNMENT_TYPE.UNASSIGNED]}
            </span>
          </div>

          {/* Unassign confirm */}
          <AnimatePresence>
            {confirmUnassign && (
              <UnassignConfirm
                onConfirm={handleUnassign}
                onCancel={() => setConfirm(false)}
                isPending={unassignMut.isPending}
              />
            )}
          </AnimatePresence>

          {/* Edit form */}
          <AnimatePresence>
            {editOpen && (
              <motion.div
                initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
                className="overflow-hidden border-t pt-4"
                style={{ borderColor:"var(--border)" }}>
                <div className="space-y-3">
                  {/* Assignment type */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5"
                      style={{ color:"var(--text-secondary)" }}>نوع التعيين</label>
                    <select value={type} onChange={(e) => setType(e.target.value as AssignmentType)}
                      className="form-input text-sm w-full">
                      {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k,v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5"
                        style={{ color:"var(--text-secondary)" }}>موظف مبيعات</label>
                      <select value={salesId} onChange={(e) => setSalesId(e.target.value)}
                        className="form-input text-sm w-full">
                        <option value="">— بدون —</option>
                        {!isLoading && salesEmployees.map((e) => (
                          <option key={e.uid} value={e.uid}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5"
                        style={{ color:"var(--text-secondary)" }}>موظف متابعة</label>
                      <select value={nutritionId} onChange={(e) => setNutritionId(e.target.value)}
                        className="form-input text-sm w-full">
                        <option value="">— بدون —</option>
                        {nutritionEmployees.map((e) => (
                          <option key={e.uid} value={e.uid}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {teams.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5"
                        style={{ color:"var(--text-secondary)" }}>الفريق</label>
                      <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
                        className="form-input text-sm w-full">
                        <option value="">— بدون فريق —</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold mb-1.5"
                      style={{ color:"var(--text-secondary)" }}>سبب التغيير (اختياري)</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)}
                      className="form-input text-sm w-full"
                      placeholder="مثال: نقل بناءً على طلب العميل"/>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSave} disabled={assignMut.isPending}
                      className="flex-1 py-2 rounded-xl text-white font-bold text-xs disabled:opacity-60"
                      style={{ background:"linear-gradient(135deg,#83A2DB,#9DB4D6)" }}>
                      {assignMut.isPending ? "جاري..." : "حفظ التعيين"}
                    </button>
                    <button onClick={() => setEditOpen(false)}
                      className="px-4 py-2 rounded-xl border text-xs font-semibold"
                      style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>
                      إلغاء
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Assignment history ── */}
      <motion.div variants={fadeUp}
        className="rounded-2xl overflow-hidden"
        style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <RotateCcw size={14} style={{ color:"var(--text-muted)" }}/>
            <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>
              سجل التعيينات
            </span>
            {!histLoading && history.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:`${ACC.indigo}18`, color:ACC.indigo }}>
                {history.length}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-3">
          {histLoading ? (
            <div className="space-y-3 animate-pulse py-2">
              {[1,2,3].map((i) => (
                <div key={i} className="h-12 rounded-xl" style={{ background:"var(--surface-2)" }}/>
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color:"var(--text-muted)" }}>
              لا يوجد سجل تعيينات
            </p>
          ) : (
            <div>
              {[...history].reverse().map((rec, i) => (
                <HistoryCard key={rec.id ?? i} rec={rec}/>
              ))}
            </div>
          )}
        </div>
      </motion.div>

    </motion.div>
  );
}
