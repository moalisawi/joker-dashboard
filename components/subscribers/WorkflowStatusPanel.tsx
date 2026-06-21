"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useChangeWorkflowStatus } from "@/hooks/useSubscriberAssignment";
import { canChangeSubscriberStatus } from "@/lib/permissionGuards";
import WorkflowStatusBadge from "@/components/subscribers/WorkflowStatusBadge";
import {
  WORKFLOW_STATUS, WORKFLOW_LABELS, WORKFLOW_COLORS,
  type WorkflowStatus,
} from "@/constants/subscriberWorkflow";
import type { Subscriber } from "@/types";
import { Activity } from "lucide-react";

interface Props {
  subscriber: Subscriber;
  onSuccess?: (msg: string) => void;
}

const ALL_STATUSES = Object.values(WORKFLOW_STATUS) as WorkflowStatus[];

export default function WorkflowStatusPanel({ subscriber, onSuccess }: Props) {
  const { user }          = useAuthStore();
  const changeStatus      = useChangeWorkflowStatus();
  const [open, setOpen]   = useState(false);
  const [note, setNote]   = useState("");
  const [err, setErr]     = useState("");

  const canChange = canChangeSubscriberStatus(user) || user?.role === "owner" || user?.role === "admin";
  const current   = subscriber.workflowStatus;

  async function handleChange(status: WorkflowStatus) {
    if (status === current) return;
    try {
      setErr("");
      await changeStatus.mutateAsync({
        subscriberId:   subscriber.id,
        subscriberName: subscriber.name,
        status,
        note: note || undefined,
      });
      onSuccess?.(`تم تغيير الحالة إلى: ${WORKFLOW_LABELS[status]}`);
      setOpen(false);
      setNote("");
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
          <Activity size={15} style={{ color: "#3B82F6" }}/>
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>حالة المسار</span>
        </div>
        {canChange && (
          <button onClick={() => setOpen((v) => !v)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg,#3B82F6,#5B5FEF)" }}>
            {open ? "إغلاق" : "تغيير"}
          </button>
        )}
      </div>

      {/* Current status */}
      <div className="px-5 py-4">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>الحالة الحالية</p>
        {current
          ? <WorkflowStatusBadge status={current} size="md"/>
          : <span className="text-xs" style={{ color: "var(--text-muted)" }}>لم يُحدَّد بعد</span>}

        {subscriber.workflowStatusNote && (
          <p className="text-xs mt-2 italic" style={{ color: "var(--text-secondary)" }}>
            &quot;{subscriber.workflowStatusNote}&quot;
          </p>
        )}
      </div>

      {/* Change form */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="border-t overflow-hidden" style={{ borderColor: "var(--border)" }}
          >
            <div className="px-5 py-4 space-y-3">
              {err && <p className="text-xs text-red-500">{err}</p>}

              <div className="grid grid-cols-3 gap-1.5">
                {ALL_STATUSES.map((status) => {
                  const cfg     = WORKFLOW_COLORS[status];
                  const active  = status === current;
                  const pending = changeStatus.isPending;
                  return (
                    <button key={status}
                      onClick={() => handleChange(status)}
                      disabled={active || pending}
                      className="px-2 py-2 rounded-xl text-[10px] font-bold transition-all text-center disabled:opacity-60"
                      style={{
                        background: active ? cfg.bg : "var(--surface-2)",
                        color:      active ? cfg.color : "var(--text-secondary)",
                        border:     `1px solid ${active ? cfg.color + "40" : "var(--border)"}`,
                      }}>
                      {WORKFLOW_LABELS[status]}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  ملاحظة (اختياري)
                </label>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="form-input w-full text-sm" placeholder="سبب تغيير الحالة..."/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
