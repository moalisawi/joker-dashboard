"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import ConfirmDialog    from "@/components/ui/ConfirmDialog";
import EmptyState       from "@/components/ui/EmptyState";
import EmployeeStatusBadge from "@/components/ui/EmployeeStatusBadge";
import PermissionsEditor   from "@/components/employees/PermissionsEditor";
import RequirePermission   from "@/components/auth/RequirePermission";

import { useAuthStore }     from "@/store/authStore";
import { useThemeStore }    from "@/store/themeStore";
import { useSubscribers }   from "@/hooks/useSubscribers";
import { useTeams }         from "@/hooks/useTeams";
import {
  useEmployeeList,
  useCreateEmployee,
  useUpdateEmployee,
  useDeactivateEmployee,
  useAssignTeam,
  useUpdatePermissions,
} from "@/features/users/hooks";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
  type GranularPermissionsInput,
} from "@/features/users/schemas";
import { getDefaultGranularPermissions, canManageRole } from "@/lib/permissions";
import { canManageUsers, canManagePermissions } from "@/lib/permissionGuards";
import type { UserProfile, EmployeeRole, EmployeeDepartment, GranularPermissions, Team } from "@/types";
import { formatNumber } from "@/lib/utils";
import {
  Users, Plus, Search, X, MoreVertical, Edit2,
  ShieldCheck, UserMinus, UserCheck, Users2,
  Briefcase, TrendingUp, UserCheck as UserCheckIcon,
  Trophy, Eye, EyeOff, Filter,
} from "lucide-react";

// ─── Accent + role meta ───────────────────────────────────────────────────────

const ROLE_META: Record<EmployeeRole, { label: string; color: string }> = {
  owner:    { label: "مالك",   color: "#f59e0b" },
  admin:    { label: "مدير",   color: "#6366f1" },
  sales:    { label: "مبيعات", color: "#10b981" },
  followup: { label: "متابعة", color: "#38bdf8" },
};

const TEAM_COLORS: Record<string, string> = {
  sales:     "#10b981",
  nutrition: "#8b5cf6",
};

const DEPARTMENTS: EmployeeDepartment[] = ["مبيعات", "متابعة", "إدارة", "أخرى"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.22 }}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-lg font-bold text-sm text-white flex items-center gap-2"
      style={{ background: ok ? "#10b981" : "#f43f5e" }}
    >
      {ok ? "✓" : "✕"} {msg}
    </motion.div>
  );
}

// ─── Actions dropdown ─────────────────────────────────────────────────────────

type Action =
  | { type: "edit" }
  | { type: "permissions" }
  | { type: "assign-team" }
  | { type: "deactivate" }
  | { type: "reactivate" };

function ActionsMenu({
  emp,
  canEdit,
  canPerms,
  onAction,
}: {
  emp: UserProfile;
  canEdit: boolean;
  canPerms: boolean;
  onAction: (a: Action) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = [
    canEdit  && { icon: <Edit2 size={13} />,       label: "تعديل البيانات",  action: { type: "edit" as const } },
    canPerms && { icon: <ShieldCheck size={13} />, label: "تعديل الصلاحيات", action: { type: "permissions" as const } },
    canEdit  && { icon: <Users2 size={13} />,      label: "تعيين فريق",      action: { type: "assign-team" as const } },
    canEdit && emp.active  && { icon: <UserMinus size={13} />, label: "تعطيل الحساب",   action: { type: "deactivate" as const }, danger: true },
    canEdit && !emp.active && { icon: <UserCheck size={13} />, label: "إعادة تفعيل",   action: { type: "reactivate" as const }, success: true },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; action: Action; danger?: boolean; success?: boolean }[];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: "var(--text-muted)" }}
      >
        <MoreVertical size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{   opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-8 w-44 rounded-xl shadow-lg border z-50 overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { onAction(item.action); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-right transition-colors hover:bg-slate-50"
                style={{
                  color: item.danger  ? "#f43f5e"
                       : item.success ? "#10b981"
                       : "var(--text-secondary)",
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Employee Form Modal (React Hook Form) ────────────────────────────────────

function EmployeeFormModal({
  mode,
  employee,
  teams,
  onClose,
  onSuccess,
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

  // ── Create form ──────────────────────────────────────────────────────────────
  const createForm = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      fullName: "", email: "", password: "",
      phone: "", employeeRole: "sales", department: "مبيعات",
      teamId: "", notes: "",
    },
  });

  // ── Edit form ────────────────────────────────────────────────────────────────
  const editForm = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      uid:          employee?.uid ?? "",
      employeeRole: employee?.employeeRole ?? "sales",
      department:   employee?.department   ?? "مبيعات",
      phone:        employee?.phone        ?? "",
      teamId:       employee?.teamId       ?? "",
      notes:        employee?.notes        ?? "",
    },
  });

  async function onSubmitCreate(data: CreateEmployeeInput) {
    try {
      await createMut.mutateAsync({ ...data, teamId: data.teamId || undefined });
      onSuccess("تم إنشاء حساب الموظف بنجاح");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      createForm.setError("root", { message: msg });
    }
  }

  async function onSubmitEdit(data: UpdateEmployeeInput) {
    try {
      await updateMut.mutateAsync({ ...data, teamId: data.teamId || null });
      onSuccess("تم تحديث بيانات الموظف");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      editForm.setError("root", { message: msg });
    }
  }

  const isCreate = mode === "create";
  const cErr = createForm.formState.errors;
  const eErr = editForm.formState.errors;
  const submitting = createMut.isPending || updateMut.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{   opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2 }}
        className="modal-panel max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            {isCreate ? "إضافة موظف جديد" : `تعديل: ${employee?.name}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {isCreate ? (
            <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4">
              {cErr.root && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {cErr.root.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  الاسم الكامل *
                </label>
                <input {...createForm.register("fullName")} className="form-input" placeholder="محمد أحمد" />
                {cErr.fullName && <p className="text-xs text-red-500 mt-1">{cErr.fullName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    البريد الإلكتروني *
                  </label>
                  <input {...createForm.register("email")} type="email" dir="ltr" className="form-input" placeholder="emp@example.com" />
                  {cErr.email && <p className="text-xs text-red-500 mt-1">{cErr.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    رقم الهاتف
                  </label>
                  <input {...createForm.register("phone")} type="tel" dir="ltr" className="form-input" placeholder="+962..." />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  كلمة المرور المؤقتة *
                  <span className="mr-1 font-normal opacity-60">(الموظف يغيّرها لاحقاً)</span>
                </label>
                <div className="relative">
                  <input
                    {...createForm.register("password")}
                    type={showPass ? "text" : "password"}
                    dir="ltr"
                    className="form-input pr-9"
                    placeholder="8 أحرف على الأقل"
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity">
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {cErr.password && <p className="text-xs text-red-500 mt-1">{cErr.password.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الدور</label>
                  <select {...createForm.register("employeeRole")} className="form-input">
                    <option value="sales">مبيعات</option>
                    <option value="followup">متابعة</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>القسم</label>
                  <select {...createForm.register("department")} className="form-input">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {teams.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الفريق</label>
                  <select {...createForm.register("teamId")} className="form-input">
                    <option value="">— بدون فريق —</option>
                    {teams.filter((t) => t.active).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>ملاحظات</label>
                <textarea {...createForm.register("notes")} className="form-input resize-none" rows={2} placeholder="اختياري..." />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {submitting ? "جاري الإنشاء..." : "إنشاء الحساب"}
                </button>
                <button type="button" onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
              {eErr.root && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {eErr.root.message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الدور</label>
                  <select {...editForm.register("employeeRole")} className="form-input">
                    <option value="sales">مبيعات</option>
                    <option value="followup">متابعة</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>القسم</label>
                  <select {...editForm.register("department")} className="form-input">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>رقم الهاتف</label>
                <input {...editForm.register("phone")} type="tel" dir="ltr" className="form-input" placeholder="+962..." />
              </div>

              {teams.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الفريق</label>
                  <select {...editForm.register("teamId")} className="form-input">
                    <option value="">— بدون فريق —</option>
                    {teams.filter((t) => t.active).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>ملاحظات</label>
                <textarea {...editForm.register("notes")} className="form-input resize-none" rows={2} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {submitting ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
                <button type="button" onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Permissions Modal ────────────────────────────────────────────────────────

function PermissionsModal({
  employee,
  onClose,
  onSuccess,
}: {
  employee: UserProfile;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const updatePerms = useUpdatePermissions();
  const initial = employee.granularPermissions ?? getDefaultGranularPermissions(employee.role);
  const [perms, setPerms] = useState<GranularPermissions>(initial);

  async function save() {
    try {
      await updatePerms.mutateAsync({ uid: employee.uid, permissions: perms as GranularPermissionsInput });
      onSuccess("تم تحديث الصلاحيات");
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{   opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2 }}
        className="modal-panel max-w-xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
              صلاحيات: {employee.name}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {ROLE_META[employee.employeeRole ?? "sales"]?.label}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[65vh]">
          <PermissionsEditor value={perms} onChange={setPerms} />
        </div>

        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={save}
            disabled={updatePerms.isPending}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
          >
            {updatePerms.isPending ? "جاري الحفظ..." : "حفظ الصلاحيات"}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Assign Team Modal ────────────────────────────────────────────────────────

function AssignTeamModal({
  employee,
  teams,
  onClose,
  onSuccess,
}: {
  employee: UserProfile;
  teams: Team[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const assignTeam = useAssignTeam();
  const [teamId, setTeamId] = useState(employee.teamId ?? "");

  async function save() {
    try {
      await assignTeam.mutateAsync({ uid: employee.uid, teamId: teamId || null });
      onSuccess("تم تحديث الفريق");
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{   opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            تعيين فريق: {employee.name}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={15} />
          </button>
        </div>

        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="form-input w-full mb-4"
        >
          <option value="">— بدون فريق —</option>
          {teams.filter((t) => t.active).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={assignTeam.isPending}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: "#6366f1" }}
          >
            {assignTeam.isPending ? "جاري..." : "حفظ"}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalState =
  | null
  | { type: "create" }
  | { type: "edit";        employee: UserProfile }
  | { type: "permissions"; employee: UserProfile }
  | { type: "assign-team"; employee: UserProfile }
  | { type: "deactivate";  employee: UserProfile }
  | { type: "reactivate";  employee: UserProfile };

export default function EmployeesPage() {
  const { user }   = useAuthStore();
  const { dark }   = useThemeStore();

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: employees = [], isLoading } = useEmployeeList();
  const { data: teams = [] }                = useTeams();
  const { subscribers }                     = useSubscribers();

  // ── Mutations ────────────────────────────────────────────────────────────────
  const deactivateMut = useDeactivateEmployee();
  const updateMut     = useUpdateEmployee();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [modal, setModal]             = useState<ModalState>(null);
  const [search, setSearch]           = useState("");
  const [roleFilter, setRoleFilter]   = useState<EmployeeRole | "">("");
  const [teamFilter, setTeamFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Permissions ──────────────────────────────────────────────────────────────
  const canEdit  = canManageUsers(user);
  const canPerms = canManagePermissions(user);

  // ── Stats per employee ───────────────────────────────────────────────────────
  const empStats = useMemo(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    subscribers.forEach((s) => {
      const key = s.convincedBy || "";
      if (!m[key]) m[key] = { count: 0, revenue: 0 };
      m[key].count++;
      m[key].revenue += s.netAmountUSD || 0;
    });
    return m;
  }, [subscribers]);

  // ── Team lookup map ──────────────────────────────────────────────────────────
  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  // ── Filtered employees ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (roleFilter   && e.employeeRole !== roleFilter)                            return false;
      if (teamFilter   && e.teamId !== teamFilter)                                  return false;
      if (statusFilter === "active"   && !e.active)                                 return false;
      if (statusFilter === "inactive" && e.active)                                  return false;
      return true;
    });
  }, [employees, search, roleFilter, teamFilter, statusFilter]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    employees.length,
    active:   employees.filter((e) => e.active).length,
    sales:    employees.filter((e) => e.employeeRole === "sales").length,
    followup: employees.filter((e) => e.employeeRole === "followup").length,
  }), [employees]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
  }

  async function handleDeactivate(emp: UserProfile) {
    try {
      await deactivateMut.mutateAsync({ uid: emp.uid });
      setModal(null);
      showToast("تم تعطيل حساب الموظف");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "حدث خطأ", false);
      setModal(null);
    }
  }

  async function handleReactivate(emp: UserProfile) {
    try {
      await updateMut.mutateAsync({ uid: emp.uid });
      // Reactivation uses a different API operation — we'll call user-operations directly
      const { callUserOperation } = await import("@/lib/clientUserOperations");
      await callUserOperation("toggleEmployee", { uid: emp.uid, active: true });
      setModal(null);
      showToast("تم إعادة تفعيل حساب الموظف");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "حدث خطأ", false);
      setModal(null);
    }
  }

  function handleAction(emp: UserProfile, action: Action) {
    if (action.type === "edit")        setModal({ type: "edit",        employee: emp });
    if (action.type === "permissions") setModal({ type: "permissions", employee: emp });
    if (action.type === "assign-team") setModal({ type: "assign-team", employee: emp });
    if (action.type === "deactivate")  setModal({ type: "deactivate",  employee: emp });
    if (action.type === "reactivate")  setModal({ type: "reactivate",  employee: emp });
  }

  const canViewRevenue = user?.role === "owner" || user?.granularPermissions?.analytics?.view;

  return (
    <ProtectedLayout>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast key="toast" msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
        )}
      </AnimatePresence>

      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-9 w-9 flex items-center justify-center rounded-xl"
                  style={{ background: "#6366f118", border: "1px solid #6366f128" }}>
                  <Briefcase size={16} style={{ color: "#6366f1" }} />
                </div>
                <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                  إدارة الموظفين
                </h1>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {stats.total} موظف · {stats.active} نشط
              </p>
            </div>

            <RequirePermission permission="manage_users">
              <button
                onClick={() => setModal({ type: "create" })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
              >
                <Plus size={16} />
                إضافة موظف
              </button>
            </RequirePermission>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "إجمالي الموظفين", value: stats.total,    icon: <Users size={16}/>,         color: "#6366f1" },
              { label: "نشطون",            value: stats.active,   icon: <UserCheckIcon size={16}/>, color: "#10b981" },
              { label: "فريق المبيعات",    value: stats.sales,    icon: <Briefcase size={16}/>,     color: "#f59e0b" },
              { label: "فريق المتابعة",    value: stats.followup, icon: <TrendingUp size={16}/>,    color: "#38bdf8" },
            ].map((s) => (
              <div key={s.label}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl"
                  style={{ background: `${s.color}18`, border: `1px solid ${s.color}28` }}>
                  <span style={{ color: s.color }}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                  <p className="text-xl font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Search + Filters ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الإيميل..."
                className="form-input w-full pr-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as EmployeeRole | "")}
              className="form-input text-sm w-full sm:w-36"
            >
              <option value="">كل الأدوار</option>
              <option value="sales">مبيعات</option>
              <option value="followup">متابعة</option>
              <option value="admin">مدير</option>
            </select>

            {/* Team filter */}
            {teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="form-input text-sm w-full sm:w-36"
              >
                <option value="">كل الفرق</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
              className="form-input text-sm w-full sm:w-32"
            >
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">معطّل</option>
            </select>

            {/* Reset */}
            {(search || roleFilter || teamFilter || statusFilter) && (
              <button
                onClick={() => { setSearch(""); setRoleFilter(""); setTeamFilter(""); setStatusFilter(""); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors hover:bg-slate-50 shrink-0"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <Filter size={12} /> مسح
              </button>
            )}
          </div>

          {/* ── Table ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#6366f140", borderTopColor: "#6366f1" }} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Users size={48} />}
                title="لا يوجد موظفون"
                description={search || roleFilter || teamFilter || statusFilter ? "جرّب تغيير معايير البحث" : "ابدأ بإضافة أول موظف"}
                action={
                  canEdit && !search && !roleFilter && !teamFilter && !statusFilter ? (
                    <button
                      onClick={() => setModal({ type: "create" })}
                      className="px-4 py-2 rounded-xl text-white text-sm font-bold"
                      style={{ background: "#6366f1" }}
                    >
                      إضافة موظف
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      {["الموظف", "الدور", "الفريق", "الحالة", "المشتركون", "الإيراد", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{ color: "var(--text-muted)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {filtered.map((emp) => {
                      const roleMeta = ROLE_META[emp.employeeRole ?? "sales"] ?? ROLE_META.sales;
                      const team     = emp.teamId ? teamMap[emp.teamId] : null;
                      const stat     = empStats[emp.name] ?? { count: 0, revenue: 0 };

                      return (
                        <tr key={emp.uid}
                          className="transition-colors hover:bg-slate-50"
                          style={{ opacity: emp.active ? 1 : 0.6 }}>

                          {/* Employee */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                                style={{ background: `linear-gradient(135deg,${roleMeta.color}cc,${roleMeta.color}88)` }}
                              >
                                {initials(emp.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
                                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{emp.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                              style={{ background: `${roleMeta.color}15`, color: roleMeta.color }}
                            >
                              {roleMeta.label}
                            </span>
                          </td>

                          {/* Team */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {team ? (
                              <span
                                className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{
                                  background: `${TEAM_COLORS[team.type] ?? "#6366f1"}15`,
                                  color:       TEAM_COLORS[team.type] ?? "#6366f1",
                                }}
                              >
                                {team.name}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <EmployeeStatusBadge active={emp.active} status={emp.status} />
                          </td>

                          {/* Subscribers */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                              {stat.count}
                            </span>
                          </td>

                          {/* Revenue */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {canViewRevenue ? (
                              <span className="font-bold tabular-nums text-emerald-500">
                                ${formatNumber(stat.revenue, 0)}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3">
                            <ActionsMenu
                              emp={emp}
                              canEdit={canEdit}
                              canPerms={canPerms}
                              onAction={(a) => handleAction(emp, a)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Performance leaderboard ── */}
          {Object.keys(empStats).some((k) => k) && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <Trophy size={15} style={{ color: "#f59e0b" }} />
                <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>لوحة الأداء</span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {Object.entries(empStats)
                  .filter(([k]) => k)
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 5)
                  .map(([name, s], i) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const total  = Object.values(empStats).reduce((acc, v) => acc + v.count, 0);
                    const pct    = total > 0 ? Math.round((s.count / total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-base w-6 text-center shrink-0">
                          {i < 3 ? medals[i] : <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{i + 1}</span>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{name}</span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                              {s.count} مشترك
                              {canViewRevenue && <span className="mr-2 text-emerald-500">${formatNumber(s.revenue, 0)}</span>}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {(modal?.type === "create" || modal?.type === "edit") && (
          <EmployeeFormModal
            key="emp-form"
            mode={modal.type}
            employee={modal.type === "edit" ? modal.employee : undefined}
            teams={teams}
            onClose={() => setModal(null)}
            onSuccess={showToast}
          />
        )}

        {modal?.type === "permissions" && (
          <PermissionsModal
            key="perms"
            employee={modal.employee}
            onClose={() => setModal(null)}
            onSuccess={showToast}
          />
        )}

        {modal?.type === "assign-team" && (
          <AssignTeamModal
            key="assign-team"
            employee={modal.employee}
            teams={teams}
            onClose={() => setModal(null)}
            onSuccess={showToast}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={modal?.type === "deactivate"}
        title="تعطيل حساب الموظف"
        description={`سيُوقف وصول ${modal?.type === "deactivate" ? modal.employee.name : ""} للنظام. حسابه يبقى محفوظاً.`}
        confirmLabel="تعطيل"
        destructive
        loading={deactivateMut.isPending}
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "deactivate") handleDeactivate(modal.employee); }}
      />

      <ConfirmDialog
        open={modal?.type === "reactivate"}
        title="إعادة تفعيل الحساب"
        description={`سيُستعاد وصول ${modal?.type === "reactivate" ? modal.employee.name : ""} للنظام.`}
        confirmLabel="إعادة تفعيل"
        loading={updateMut.isPending}
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "reactivate") handleReactivate(modal.employee); }}
      />

    </ProtectedLayout>
  );
}
