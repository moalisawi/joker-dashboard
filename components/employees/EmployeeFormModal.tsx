"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { X, Eye, EyeOff, Phone, Info } from "lucide-react";

import PermissionSummary from "@/components/employees/PermissionSummary";
import { useCreateEmployee, useUpdateEmployee } from "@/features/users/hooks";
import {
  createEmployeeSchema, updateEmployeeSchema,
  type CreateEmployeeInput, type UpdateEmployeeInput,
} from "@/features/users/schemas";
import { EMPLOYEE_AUTH_ROLE } from "@/lib/permissions";
import type { UserProfile, EmployeeRole, EmployeeDepartment, Team } from "@/types";

const DEPARTMENTS: EmployeeDepartment[] = ["مبيعات", "متابعة", "إدارة", "أخرى"];

/**
 * The assignable jobs.
 *
 * `owner` is absent on purpose. EMPLOYEE_AUTH_ROLE maps it to the owner role,
 * and canAssignRole() lets an owner assign anything — so offering it here would
 * make creating a second owner a two-click accident in the same menu used to
 * hire a salesperson. Promoting someone to owner is done deliberately, from the
 * role control on the directory row, and only by an owner.
 */
const JOB_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "sales",       label: "مبيعات" },
  { value: "followup",    label: "متابعة" },
  { value: "team_leader", label: "قائد فريق" },
  { value: "admin",       label: "مدير" },
];

function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}
        {hint && <span className="mr-1 font-normal opacity-60">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function EmployeeFormModal({
  mode, employee, teams, onClose, onSuccess,
}: {
  mode: "create" | "edit";
  employee?: UserProfile;
  teams: Team[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const createMut = useCreateEmployee();
  const updateMut = useUpdateEmployee();
  const isCreate  = mode === "create";

  const cf = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      fullName: "", email: "", password: "", phone: "",
      employeeRole: "sales", department: "مبيعات", teamId: "", notes: "",
      initialStatus: "active",
    },
  });

  type EditFormData = Omit<UpdateEmployeeInput, "uid">;
  const ef = useForm<EditFormData>({
    resolver: zodResolver(updateEmployeeSchema.omit({ uid: true })),
    defaultValues: {
      employeeRole: (employee?.employeeRole ?? "sales") as EditFormData["employeeRole"],
      department:   (employee?.department   ?? "مبيعات") as EditFormData["department"],
      phone:        employee?.phone  ?? "",
      teamId:       employee?.teamId ?? "",
      notes:        employee?.notes  ?? "",
    },
  });

  // useWatch, not form.watch(): `watch()` returns a fresh function on every
  // render, which makes React Compiler skip memoizing this whole component
  // ("incompatible library"). useWatch subscribes to the field instead and
  // re-renders only when it changes.
  const createJob = useWatch({ control: cf.control, name: "employeeRole" });
  const editJob   = useWatch({ control: ef.control, name: "employeeRole" });
  const initial   = useWatch({ control: cf.control, name: "initialStatus" });

  const watchedJob  = (isCreate ? createJob : editJob) ?? "sales";
  const watchedInit = initial ?? "active";
  const pending     = createMut.isPending || updateMut.isPending;
  const rootError   = isCreate
    ? cf.formState.errors.root?.message
    : (ef.formState.errors as { root?: { message?: string } }).root?.message;

  async function onCreateSubmit(data: CreateEmployeeInput) {
    try {
      await createMut.mutateAsync({ ...data, teamId: data.teamId || undefined });
      onSuccess(
        data.initialStatus === "pending"
          ? "تم إنشاء الحساب بحالة «بانتظار التفعيل»"
          : "تم إنشاء حساب الموظف بنجاح"
      );
      onClose();
    } catch (e) {
      cf.setError("root", { message: e instanceof Error ? e.message : "حدث خطأ" });
    }
  }

  async function onEditSubmit(data: EditFormData) {
    try {
      await updateMut.mutateAsync({ ...data, uid: employee!.uid, teamId: data.teamId || null });
      onSuccess("تم تحديث بيانات الموظف");
      onClose();
    } catch (e) {
      ef.setError("root", { message: e instanceof Error ? e.message : "حدث خطأ" });
    }
  }

  const activeTeams = teams.filter((t) => t.active);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2 }}
        className="modal-panel max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            {isCreate ? "إضافة مستخدم جديد" : `تعديل: ${employee?.name}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={isCreate ? cf.handleSubmit(onCreateSubmit) : ef.handleSubmit(onEditSubmit)}
          className="p-5 space-y-4 overflow-y-auto max-h-[70vh]"
        >
          {rootError && (
            <div className="p-3 rounded-xl text-sm" style={{ background: "#EF444410", border: "1px solid #EF444430", color: "#EF4444" }}>
              {rootError}
            </div>
          )}

          {isCreate && (
            <>
              <Field label="الاسم الكامل *" error={cf.formState.errors.fullName?.message}>
                <input {...cf.register("fullName")} className="form-input" placeholder="محمد أحمد" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="البريد الإلكتروني *" error={cf.formState.errors.email?.message}>
                  <input {...cf.register("email")} type="email" dir="ltr" className="form-input" placeholder="emp@example.com" />
                </Field>
                <Field label="رقم الهاتف">
                  <div className="relative">
                    <input {...cf.register("phone")} type="tel" dir="ltr" className="form-input pr-8" placeholder="+962..." />
                    <Phone size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30" />
                  </div>
                </Field>
              </div>

              <Field
                label="كلمة المرور المؤقتة *"
                hint="(تُسلَّم للموظف ويغيّرها لاحقاً)"
                error={cf.formState.errors.password?.message}
              >
                <div className="relative">
                  <input
                    {...cf.register("password")}
                    type={showPass ? "text" : "password"}
                    dir="ltr"
                    className="form-input pr-9"
                    placeholder="8 أحرف على الأقل"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
                  >
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="الدور الوظيفي">
              <select
                {...(isCreate ? cf.register("employeeRole") : ef.register("employeeRole"))}
                className="form-input"
              >
                {JOB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="القسم">
              <select
                {...(isCreate ? cf.register("department") : ef.register("department"))}
                className="form-input"
              >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          {!isCreate && (
            <Field label="رقم الهاتف">
              <div className="relative">
                <input {...ef.register("phone")} type="tel" dir="ltr" className="form-input pr-8" placeholder="+962..." />
                <Phone size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30" />
              </div>
            </Field>
          )}

          {activeTeams.length > 0 && (
            <Field label="الفريق">
              <select
                {...(isCreate ? cf.register("teamId") : ef.register("teamId"))}
                className="form-input"
              >
                <option value="">— بدون فريق —</option>
                {activeTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}

          <Field label="ملاحظات داخلية">
            <textarea
              {...(isCreate ? cf.register("notes") : ef.register("notes"))}
              className="form-input resize-none"
              rows={2}
              placeholder="اختياري…"
            />
          </Field>

          {isCreate && (
            <Field label="حالة البدء">
              <select {...cf.register("initialStatus")} className="form-input">
                <option value="active">نشط — يستطيع الدخول فوراً</option>
                <option value="pending">بانتظار التفعيل — الحساب جاهز والدخول مغلق</option>
              </select>
              {watchedInit === "pending" && (
                <p className="flex items-start gap-1.5 text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                  <Info size={12} className="shrink-0 mt-0.5" />
                  يُنشأ الحساب بكامل بياناته وصلاحياته لكنه لا يستطيع الدخول حتى تفعّله من قائمة المستخدمين.
                </p>
              )}
            </Field>
          )}

          {/* Say what this will grant, before it is granted. */}
          <PermissionSummary
            role={EMPLOYEE_AUTH_ROLE[watchedJob as EmployeeRole] ?? "employee"}
            employeeRole={watchedJob as EmployeeRole}
            title={isCreate ? "هذا المستخدم سيستطيع" : "هذا المستخدم يستطيع"}
            compact
          />

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition"
              style={{ background: "linear-gradient(135deg,#5B5FEF,#3B82F6)" }}
            >
              {pending ? "جارٍ الحفظ…" : isCreate ? "إنشاء الحساب" : "حفظ التعديلات"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
