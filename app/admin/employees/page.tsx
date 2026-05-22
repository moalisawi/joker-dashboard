"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

import ProtectedLayout     from "@/components/layout/ProtectedLayout";
import PageHeader          from "@/components/layout/PageHeader";
import TableSkeleton       from "@/components/ui/TableSkeleton";
import ConfirmDialog       from "@/components/ui/ConfirmDialog";
import EmptyState          from "@/components/ui/EmptyState";
import EmployeeStatusBadge from "@/components/ui/EmployeeStatusBadge";
import PermissionsEditor   from "@/components/employees/PermissionsEditor";
import RequirePermission   from "@/components/auth/RequirePermission";

import { useAuthStore }  from "@/store/authStore";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useTeams }       from "@/hooks/useTeams";
import {
  useEmployeeList, useCreateEmployee, useUpdateEmployee,
  useDeactivateEmployee, useDeleteEmployee, useAssignTeam, useUpdatePermissions,
} from "@/features/users/hooks";
import {
  createEmployeeSchema, updateEmployeeSchema,
  type CreateEmployeeInput, type UpdateEmployeeInput,
  type GranularPermissionsInput,
} from "@/features/users/schemas";
import { getDefaultGranularPermissions, canManageRole } from "@/lib/permissions";
import { canManageUsers, canManagePermissions }         from "@/lib/permissionGuards";
import { COLLECTIONS } from "@/constants/collections";
import { PERM }         from "@/constants/permissions";
import { callUserOperation } from "@/lib/clientUserOperations";
import type { UserProfile, EmployeeRole, EmployeeDepartment, GranularPermissions, Team } from "@/types";
import { formatNumber } from "@/lib/utils";
import {
  Briefcase, Plus, Search, X, MoreVertical, Edit2,
  ShieldCheck, UserMinus, UserCheck, Users2,
  Users, TrendingUp, UserCheck as UCk, Trophy,
  Eye, EyeOff, Filter, Phone, Lock, Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_META: Record<EmployeeRole, { label: string; color: string }> = {
  owner:       { label: "مالك",        color: "#F59E0B" },
  admin:       { label: "مدير",        color: "#5B5FEF" },
  team_leader: { label: "قائد فريق",   color: "#3B82F6" },
  sales:       { label: "مبيعات",      color: "#5B5FEF" },
  followup:    { label: "متابعة",      color: "#3B82F6" },
};

const TEAM_COLORS: Record<string, string> = { sales: "#5B5FEF", nutrition: "#3B82F6" };
const DEPARTMENTS: EmployeeDepartment[]   = ["مبيعات", "متابعة", "إدارة", "أخرى"];

function initials(n: string) {
  return n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

/** Active + total permissions for a user */
function permCount(user: UserProfile): { active: number; total: number } {
  const gp = user.granularPermissions ?? getDefaultGranularPermissions(user.role);
  let active = 0, total = 0;
  for (const cat of Object.values(gp) as Record<string, boolean>[]) {
    for (const val of Object.values(cat)) {
      total++;
      if (val) active++;
    }
  }
  return { active, total };
}

// ─── Actions dropdown ─────────────────────────────────────────────────────────

type ActionType = "edit" | "permissions" | "assign-team" | "deactivate" | "reactivate" | "delete";

function ActionsMenu({
  emp, canEdit, canPerms, isOwner,
  onAction,
}: {
  emp: UserProfile; canEdit: boolean; canPerms: boolean; isOwner: boolean;
  onAction: (t: ActionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const items: { icon: React.ReactNode; label: string; type: ActionType; color?: string }[] = [
    ...(canEdit  ? [{ icon: <Edit2 size={13}/>,       label: "تعديل البيانات",   type: "edit"         as ActionType }] : []),
    ...(canPerms ? [{ icon: <ShieldCheck size={13}/>, label: "تعديل الصلاحيات", type: "permissions"  as ActionType }] : []),
    ...(canEdit  ? [{ icon: <Users2 size={13}/>,      label: "تعيين فريق",      type: "assign-team"  as ActionType }] : []),
    ...(canEdit && emp.active  ? [{ icon: <UserMinus size={13}/>, label: "تعطيل الحساب",  type: "deactivate"  as ActionType, color: "#F59E0B" }] : []),
    ...(canEdit && !emp.active ? [{ icon: <UserCheck size={13}/>, label: "إعادة تفعيل",   type: "reactivate"  as ActionType, color: "#5B5FEF" }] : []),
    ...(isOwner ? [{ icon: <Trash2 size={13}/>, label: "حذف نهائياً", type: "delete" as ActionType, color: "#EF4444" }] : []),
  ];

  if (!items.length) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: "var(--text-muted)" }}>
        <MoreVertical size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{   opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-8 w-44 rounded-xl shadow-lg border z-50 overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {items.map((item) => (
              <button key={item.type}
                onClick={() => { onAction(item.type); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-right transition-colors hover:bg-slate-50"
                style={{ color: item.color ?? "var(--text-secondary)" }}>
                {item.icon}{item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Employee Form Modal ──────────────────────────────────────────────────────

function EmployeeFormModal({
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
    defaultValues: { fullName:"", email:"", password:"", phone:"", employeeRole:"sales", department:"مبيعات", teamId:"", notes:"" },
  });
  // uid is taken from props, not from form fields — avoids SubmitHandler type mismatch
  type EditFormData = Omit<UpdateEmployeeInput, "uid">;
  const editSchema = updateEmployeeSchema.omit({ uid: true });

  const ef = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      employeeRole: (employee?.employeeRole ?? "sales") as EditFormData["employeeRole"],
      department:   (employee?.department   ?? "مبيعات") as EditFormData["department"],
      phone:        employee?.phone  ?? "",
      teamId:       employee?.teamId ?? "",
      notes:        employee?.notes  ?? "",
    },
  });

  async function onCreateSubmit(data: CreateEmployeeInput) {
    try {
      await createMut.mutateAsync({ ...data, teamId: data.teamId || undefined });
      onSuccess("تم إنشاء حساب الموظف بنجاح");
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

  const cErr     = cf.formState.errors;
  const eErr     = ef.formState.errors;
  const pending  = createMut.isPending || updateMut.isPending;

  const RoleOptions = () => (
    <>
      <option value="sales">مبيعات</option>
      <option value="followup">متابعة</option>
      <option value="team_leader">قائد فريق</option>
      <option value="admin">مدير</option>
    </>
  );

  const TeamSelect = ({ reg }: { reg: object }) => (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>الفريق</label>
      <select {...(reg as React.SelectHTMLAttributes<HTMLSelectElement>)} className="form-input">
        <option value="">— بدون فريق —</option>
        {teams.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.97, y:12 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.97, y:12 }} transition={{ duration:0.2 }}
        className="modal-panel max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
          <h3 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>
            {isCreate ? "إضافة موظف جديد" : `تعديل: ${employee?.name}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"><X size={16}/></button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[72vh]">
          {isCreate ? (
            <form onSubmit={cf.handleSubmit(onCreateSubmit)} className="space-y-4">
              {cErr.root && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{cErr.root.message}</div>}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>الاسم الكامل *</label>
                <input {...cf.register("fullName")} className="form-input" placeholder="محمد أحمد" />
                {cErr.fullName && <p className="text-xs text-red-500 mt-1">{cErr.fullName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>البريد الإلكتروني *</label>
                  <div className="relative">
                    <input {...cf.register("email")} type="email" dir="ltr" className="form-input" placeholder="emp@example.com" />
                  </div>
                  {cErr.email && <p className="text-xs text-red-500 mt-1">{cErr.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>رقم الهاتف</label>
                  <div className="relative">
                    <input {...cf.register("phone")} type="tel" dir="ltr" className="form-input pr-8" placeholder="+962..." />
                    <Phone size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30"/>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>
                  كلمة المرور المؤقتة *
                  <span className="mr-1 font-normal opacity-60">(الموظف يغيّرها لاحقاً)</span>
                </label>
                <div className="relative">
                  <input {...cf.register("password")} type={showPass ? "text" : "password"} dir="ltr" className="form-input pr-9" placeholder="8 أحرف على الأقل"/>
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity">
                    {showPass ? <EyeOff size={13}/> : <Eye size={13}/>}
                  </button>
                </div>
                {cErr.password && <p className="text-xs text-red-500 mt-1">{cErr.password.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>الدور</label>
                  <select {...cf.register("employeeRole")} className="form-input"><RoleOptions/></select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>القسم</label>
                  <select {...cf.register("department")} className="form-input">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {teams.length > 0 && <TeamSelect reg={cf.register("teamId")} />}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>ملاحظات</label>
                <textarea {...cf.register("notes")} className="form-input resize-none" rows={2} placeholder="اختياري..."/>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={pending}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition"
                  style={{ background:"linear-gradient(135deg,#5B5FEF,#3B82F6)" }}>
                  {pending ? "جاري الإنشاء..." : "إنشاء الحساب"}
                </button>
                <button type="button" onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>إلغاء</button>
              </div>
            </form>
          ) : (
            <form onSubmit={ef.handleSubmit(onEditSubmit)} className="space-y-4">
              {eErr.root && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{eErr.root.message}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>الدور</label>
                  <select {...ef.register("employeeRole")} className="form-input"><RoleOptions/></select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>القسم</label>
                  <select {...ef.register("department")} className="form-input">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>رقم الهاتف</label>
                <div className="relative">
                  <input {...ef.register("phone")} type="tel" dir="ltr" className="form-input pr-8" placeholder="+962..."/>
                  <Phone size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30"/>
                </div>
              </div>

              {teams.length > 0 && <TeamSelect reg={ef.register("teamId")} />}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>ملاحظات</label>
                <textarea {...ef.register("notes")} className="form-input resize-none" rows={2}/>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={pending}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition"
                  style={{ background:"linear-gradient(135deg,#5B5FEF,#3B82F6)" }}>
                  {pending ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
                <button type="button" onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>إلغاء</button>
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
  employee, onClose, onSuccess,
}: { employee: UserProfile; onClose: () => void; onSuccess: (msg: string) => void; }) {
  const updatePerms = useUpdatePermissions();
  const [perms, setPerms] = useState<GranularPermissions>(
    employee.granularPermissions ?? getDefaultGranularPermissions(employee.role)
  );

  async function save() {
    try {
      await updatePerms.mutateAsync({ uid: employee.uid, permissions: perms as GranularPermissionsInput });
      onSuccess("تم تحديث الصلاحيات");
      onClose();
    } catch (e) { alert(e instanceof Error ? e.message : "حدث خطأ"); }
  }

  const pc = permCount(employee);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.97, y:12 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.97, y:12 }} transition={{ duration:0.2 }}
        className="modal-panel max-w-xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
          <div>
            <h3 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>صلاحيات: {employee.name}</h3>
            <p className="text-xs mt-0.5" style={{ color:"var(--text-secondary)" }}>
              {ROLE_META[employee.employeeRole ?? "sales"]?.label} · {pc.active}/{pc.total} صلاحية مفعّلة
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"><X size={16}/></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[65vh]">
          <PermissionsEditor value={perms} onChange={setPerms}/>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor:"var(--border)" }}>
          <button onClick={save} disabled={updatePerms.isPending}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background:"linear-gradient(135deg,#5B5FEF,#3B82F6)" }}>
            {updatePerms.isPending ? "جاري الحفظ..." : "حفظ الصلاحيات"}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>إلغاء</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Assign Team Modal ────────────────────────────────────────────────────────

function AssignTeamModal({ employee, teams, onClose, onSuccess }:{
  employee: UserProfile; teams: Team[];
  onClose: () => void; onSuccess: (msg: string) => void;
}) {
  const assignTeam = useAssignTeam();
  const [teamId, setTeamId] = useState(employee.teamId ?? "");

  async function save() {
    try {
      await assignTeam.mutateAsync({ uid: employee.uid, teamId: teamId || null });
      onSuccess("تم تحديث الفريق");
      onClose();
    } catch (e) { alert(e instanceof Error ? e.message : "حدث خطأ"); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.97, y:8 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.97, y:8 }} transition={{ duration:0.18 }}
        className="modal-panel max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>تعيين فريق: {employee.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"><X size={15}/></button>
        </div>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="form-input w-full mb-4">
          <option value="">— بدون فريق —</option>
          {teams.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={save} disabled={assignTeam.isPending}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background:"#5B5FEF" }}>
            {assignTeam.isPending ? "جاري..." : "حفظ"}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>إلغاء</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalState =
  | null
  | { type: "create" }
  | { type: "edit" | "permissions" | "assign-team" | "deactivate" | "reactivate" | "delete"; emp: UserProfile };

export default function AdminEmployeesPage() {
  const router     = useRouter();
  const { user }   = useAuthStore();
  // ── Route guard ───────────────────────────────────────────────────────────────
  const { loading } = useAuthStore();
  useEffect(() => {
    if (!loading && user && !canManageUsers(user)) router.replace("/");
  }, [user, loading, router]);

  // ── Data ──────────────────────────────────────────────────────────────────────
  const { data: employees = [], isLoading } = useEmployeeList();
  const { data: teams     = [] }            = useTeams();
  const { subscribers }                     = useSubscribers();

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const deactivateMut = useDeactivateEmployee();
  const deleteMut     = useDeleteEmployee();
  const updateMut     = useUpdateEmployee();

  // ── UI State ──────────────────────────────────────────────────────────────────
  const [modal, setModal]               = useState<ModalState>(null);
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState<EmployeeRole | "">("");
  const [teamFilter, setTeamFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const canEdit  = canManageUsers(user);
  const canPerms = canManagePermissions(user);
  const isOwner  = user?.role === "owner";

  // ── Computed ──────────────────────────────────────────────────────────────────
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

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  const filtered = useMemo(() => employees.filter((e) => {
    const q = search.toLowerCase();
    if (q && !e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q) && !(e.phone ?? "").includes(q)) return false;
    if (roleFilter   && e.employeeRole !== roleFilter) return false;
    if (teamFilter   && e.teamId !== teamFilter)       return false;
    if (statusFilter === "active"   && !e.active)      return false;
    if (statusFilter === "inactive" &&  e.active)      return false;
    return true;
  }), [employees, search, roleFilter, teamFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:    employees.length,
    active:   employees.filter((e) => e.active).length,
    sales:    employees.filter((e) => e.employeeRole === "sales").length,
    followup: employees.filter((e) => e.employeeRole === "followup").length,
  }), [employees]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  async function handleDeactivate(emp: UserProfile) {
    try {
      await deactivateMut.mutateAsync({ uid: emp.uid });
      setModal(null);
      toast.success("تم تعطيل حساب الموظف");
    } catch (e) { toast.error(e instanceof Error ? e.message : "حدث خطأ"); setModal(null); }
  }

  async function handleReactivate(emp: UserProfile) {
    try {
      await callUserOperation("toggleEmployee", { uid: emp.uid, active: true });
      updateMut.mutate({ uid: emp.uid });
      setModal(null);
      toast.success("تم إعادة تفعيل الحساب");
    } catch (e) { toast.error(e instanceof Error ? e.message : "حدث خطأ"); setModal(null); }
  }

  async function handleDelete(emp: UserProfile) {
    try {
      await deleteMut.mutateAsync(emp.uid);
      setModal(null);
      toast.success("تم حذف حساب الموظف نهائياً");
    } catch (e) { toast.error(e instanceof Error ? e.message : "حدث خطأ"); setModal(null); }
  }

  const hasFilters = search || roleFilter || teamFilter || statusFilter;
  const canViewRev = user?.role === "owner" || user?.granularPermissions?.analytics?.view;

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background:"var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-6">

          {/* Header */}
          <PageHeader
            title="الموظفون"
            subtitle={`${stats.total} موظف · ${stats.active} نشط`}
            actions={
              <RequirePermission permission={PERM.MANAGE_USERS}>
                <button onClick={() => setModal({ type: "create" })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-all hover:opacity-90"
                  style={{ background:"linear-gradient(135deg,#5B5FEF,#3B82F6)" }}>
                  <Plus size={16}/> إضافة موظف
                </button>
              </RequirePermission>
            }
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label:"إجمالي الموظفين", value:stats.total,    icon:<Users size={16}/>,    color:"#5B5FEF" },
              { label:"نشطون",            value:stats.active,   icon:<UCk   size={16}/>,    color:"#5B5FEF" },
              { label:"فريق المبيعات",    value:stats.sales,    icon:<Briefcase size={16}/>,color:"#F59E0B" },
              { label:"فريق المتابعة",    value:stats.followup, icon:<TrendingUp size={16}/>,color:"#3B82F6" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
                <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl"
                  style={{ background:`${s.color}18`, border:`1px solid ${s.color}28` }}>
                  <span style={{ color:s.color }}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color:"var(--text-muted)" }}>{s.label}</p>
                  <p className="text-xl font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40"/>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو البريد أو الهاتف..."
                className="form-input w-full pr-9 text-sm"/>
              {search && <button onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"><X size={13}/></button>}
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as EmployeeRole | "")} className="form-input text-sm w-full sm:w-36">
              <option value="">كل الأدوار</option>
              <option value="sales">مبيعات</option>
              <option value="followup">متابعة</option>
              <option value="admin">مدير</option>
            </select>
            {teams.length > 0 && (
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="form-input text-sm w-full sm:w-36">
                <option value="">كل الفرق</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")} className="form-input text-sm w-full sm:w-32">
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">معطّل</option>
            </select>
            {hasFilters && (
              <button onClick={() => { setSearch(""); setRoleFilter(""); setTeamFilter(""); setStatusFilter(""); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors hover:bg-slate-50 shrink-0"
                style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>
                <Filter size={12}/> مسح
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>

            {/* Column headers */}
            {!isLoading && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right" style={{ background:"var(--surface-2)", borderBottom:"1px solid var(--border)" }}>
                      {["الموظف", "الدور", "الفريق", "الحالة", "الصلاحيات", "المشتركون", "الإيراد", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{ color:"var(--text-muted)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor:"var(--border)" }}>
                    {filtered.map((emp) => {
                      const role  = ROLE_META[emp.employeeRole ?? "sales"] ?? ROLE_META.sales;
                      const team  = emp.teamId ? teamMap[emp.teamId] : null;
                      const stat  = empStats[emp.name] ?? { count:0, revenue:0 };
                      const pc    = permCount(emp);

                      return (
                        <tr key={emp.uid} className="transition-colors hover:bg-slate-50"
                          style={{ opacity: emp.active ? 1 : 0.55 }}>

                          {/* Employee: name + email + phone */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                                style={{ background:`linear-gradient(135deg,${role.color}cc,${role.color}88)` }}>
                                {initials(emp.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color:"var(--text-primary)" }}>{emp.name}</p>
                                <p className="text-xs truncate" style={{ color:"var(--text-muted)" }}>{emp.email}</p>
                                {emp.phone && (
                                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color:"var(--text-muted)" }}>
                                    <Phone size={10}/>{emp.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                              style={{ background:`${role.color}15`, color:role.color }}>
                              {role.label}
                            </span>
                          </td>

                          {/* Team */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {team ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{ background:`${TEAM_COLORS[team.type] ?? "#5B5FEF"}15`, color:TEAM_COLORS[team.type] ?? "#5B5FEF" }}>
                                {team.name}
                              </span>
                            ) : <span style={{ color:"var(--text-muted)" }} className="text-xs">—</span>}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <EmployeeStatusBadge active={emp.active} status={emp.status}/>
                          </td>

                          {/* Permissions count */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                              style={{ background:"#5B5FEF10", color:"#5B5FEF" }}>
                              <Lock size={10}/>
                              {pc.active}/{pc.total}
                            </span>
                          </td>

                          {/* Subscribers */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold tabular-nums" style={{ color:"var(--text-primary)" }}>{stat.count}</span>
                          </td>

                          {/* Revenue */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {canViewRev
                              ? <span className="font-bold tabular-nums text-emerald-500">${formatNumber(stat.revenue,0)}</span>
                              : <span style={{ color:"var(--text-muted)" }}>—</span>}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3">
                            <ActionsMenu
                              emp={emp} canEdit={canEdit} canPerms={canPerms} isOwner={isOwner}
                              onAction={(t) => setModal({ type: t, emp })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {isLoading && <TableSkeleton rows={7} cols={7}/>}

            {!isLoading && filtered.length === 0 && (
              <EmptyState
                icon={<Users size={48}/>}
                title="لا يوجد موظفون"
                description={hasFilters ? "جرّب تغيير معايير البحث" : "ابدأ بإضافة أول موظف"}
                action={canEdit && !hasFilters
                  ? <button onClick={() => setModal({ type:"create" })}
                      className="px-4 py-2 rounded-xl text-white text-sm font-bold"
                      style={{ background:"#5B5FEF" }}>إضافة موظف</button>
                  : undefined}
              />
            )}
          </div>

          {/* Performance leaderboard */}
          {Object.keys(empStats).some((k) => k) && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
              <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
                <Trophy size={15} style={{ color:"#F59E0B" }}/>
                <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>لوحة الأداء</span>
              </div>
              <div className="divide-y" style={{ borderColor:"var(--border)" }}>
                {Object.entries(empStats).filter(([k]) => k)
                  .sort((a,b) => b[1].count - a[1].count).slice(0,5)
                  .map(([name, s], i) => {
                    const medals = ["🥇","🥈","🥉"];
                    const total  = Object.values(empStats).reduce((acc,v) => acc+v.count, 0);
                    const pct    = total > 0 ? Math.round((s.count/total)*100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-base w-6 text-center shrink-0">
                          {i < 3 ? medals[i] : <span className="text-xs font-bold" style={{ color:"var(--text-muted)" }}>{i+1}</span>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold truncate" style={{ color:"var(--text-primary)" }}>{name}</span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color:"var(--text-secondary)" }}>
                              {s.count} مشترك
                              {canViewRev && <span className="mr-2 text-emerald-500">${formatNumber(s.revenue,0)}</span>}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"var(--surface-2)" }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width:`${pct}%`, background:"linear-gradient(90deg,#5B5FEF,#3B82F6)" }}/>
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

      {/* Modals */}
      <AnimatePresence>
        {(modal?.type === "create" || modal?.type === "edit") && (
          <EmployeeFormModal
            key="form" mode={modal.type}
            employee={modal.type === "edit" ? modal.emp : undefined}
            teams={teams} onClose={() => setModal(null)} onSuccess={toast.success}
          />
        )}
        {modal?.type === "permissions" && (
          <PermissionsModal key="perms" employee={modal.emp}
            onClose={() => setModal(null)} onSuccess={toast.success}/>
        )}
        {modal?.type === "assign-team" && (
          <AssignTeamModal key="team" employee={modal.emp} teams={teams}
            onClose={() => setModal(null)} onSuccess={toast.success}/>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={modal?.type === "deactivate"}
        title="تعطيل حساب الموظف"
        description={`سيُوقف وصول ${modal?.type === "deactivate" ? modal.emp.name : ""} للنظام.`}
        confirmLabel="تعطيل" destructive
        loading={deactivateMut.isPending}
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "deactivate") handleDeactivate(modal.emp); }}
      />

      <ConfirmDialog
        open={modal?.type === "reactivate"}
        title="إعادة تفعيل الحساب"
        description={`سيُستعاد وصول ${modal?.type === "reactivate" ? modal.emp.name : ""} للنظام.`}
        confirmLabel="إعادة تفعيل"
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "reactivate") handleReactivate(modal.emp); }}
      />

      <ConfirmDialog
        open={modal?.type === "delete"}
        title="حذف الموظف نهائياً"
        description={`سيُحذف حساب ${modal?.type === "delete" ? modal.emp.name : ""} بشكل دائم ولن تتمكن من استعادته. البيانات التاريخية ستبقى.`}
        confirmLabel="حذف نهائياً" destructive
        loading={deleteMut.isPending}
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "delete") handleDelete(modal.emp); }}
      />
    </ProtectedLayout>
  );
}
