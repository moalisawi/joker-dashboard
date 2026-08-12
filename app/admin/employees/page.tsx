"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import ProtectedLayout      from "@/components/layout/ProtectedLayout";
import PageHeader           from "@/components/layout/PageHeader";
import TableSkeleton        from "@/components/ui/TableSkeleton";
import ConfirmDialog        from "@/components/ui/ConfirmDialog";
import EmptyState           from "@/components/ui/EmptyState";
import EmployeeStatusBadge  from "@/components/ui/EmployeeStatusBadge";
import PermissionsEditor    from "@/components/employees/PermissionsEditor";
import PermissionSummary    from "@/components/employees/PermissionSummary";
import EmployeeFormModal    from "@/components/employees/EmployeeFormModal";
import LifecycleModal, { type LifecycleAction } from "@/components/employees/LifecycleModal";
import RequirePermission    from "@/components/auth/RequirePermission";

import { useAuthStore } from "@/store/authStore";
import { useTeams }     from "@/hooks/useTeams";
import { auth }         from "@/lib/auth";
import { permissionService } from "@/services";
import {
  useUserDirectory, useAssignTeam, useUpdatePermissions,
} from "@/features/users/hooks";
import type { GranularPermissionsInput } from "@/features/users/schemas";
import {
  ROLE_LABELS, ACCOUNT_STATUS_LABELS, canManageRole, canAssignRole,
  effectivePermissions, resolveAccountStatus,
} from "@/lib/permissions";
import {
  canManageUsers, canManagePermissions, canReadUserDirectory, canActivateAccounts,
} from "@/lib/permissionGuards";
import { PERM } from "@/constants/permissions";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type {
  UserProfile, Role, AccountStatus, EmployeeRole, GranularPermissions, Team,
} from "@/types";
import {
  Plus, Search, X, MoreVertical, Edit2, ShieldCheck, UserMinus, UserCheck,
  Users2, Users, Filter, Phone, Trash2, ArrowLeftRight, Eye, PauseCircle,
  AlertTriangle, ArchiveRestore,
} from "lucide-react";

// ─── Static metadata ──────────────────────────────────────────────────────────

const JOB_META: Record<EmployeeRole, { label: string; color: string }> = {
  owner:       { label: "مالك",      color: "#F59E0B" },
  admin:       { label: "مدير",      color: "#5B5FEF" },
  team_leader: { label: "قائد فريق", color: "#3B82F6" },
  sales:       { label: "مبيعات",    color: "#5B5FEF" },
  followup:    { label: "متابعة",    color: "#3B82F6" },
};

const TEAM_COLORS: Record<string, string> = { sales: "#5B5FEF", nutrition: "#3B82F6" };

/**
 * The lifecycle states, in the order a person moves through them. The counters
 * across the top follow this order for the same reason the table does: it is
 * the shape of the process, not an alphabet.
 */
const STATUS_ORDER: AccountStatus[] = ["active", "pending", "suspended", "disabled", "deleted"];

const STATUS_COLOR: Record<AccountStatus, string> = {
  active:    "#5B5FEF",
  pending:   "#F59E0B",
  suspended: "#EF4444",
  disabled:  "#9CA3AF",
  deleted:   "#6B7280",
};

function initials(n: string) {
  return n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

/** Active vs. total effective permissions — the clamped figure, not what is stored. */
function permCount(user: UserProfile): { active: number; total: number } {
  const gp = effectivePermissions({
    role: user.role, employeeRole: user.employeeRole, granularPermissions: user.granularPermissions,
  }) as unknown as Record<string, Record<string, boolean>>;
  let active = 0, total = 0;
  for (const cat of Object.values(gp)) {
    for (const val of Object.values(cat)) { total++; if (val) active++; }
  }
  return { active, total };
}

// ─── Row actions ──────────────────────────────────────────────────────────────

type ActionType =
  | "view" | "edit" | "permissions" | "assign-team"
  | "deactivate" | "suspend" | "reactivate" | "transfer" | "archive";

function ActionsMenu({ items, onAction }: {
  items: { icon: React.ReactNode; label: string; type: ActionType; color?: string }[];
  onAction: (t: ActionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  if (!items.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="إجراءات"
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
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-8 w-48 rounded-xl shadow-lg border z-50 overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {items.map((item) => (
              <button
                key={item.type}
                onClick={() => { onAction(item.type); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-right transition-colors hover:bg-slate-50"
                style={{ color: item.color ?? "var(--text-secondary)" }}
              >
                {item.icon}{item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Permissions modal ────────────────────────────────────────────────────────

function PermissionsModal({ employee, onClose }: { employee: UserProfile; onClose: () => void }) {
  const updatePerms = useUpdatePermissions();
  const [perms, setPerms] = useState<GranularPermissions>(
    () => effectivePermissions({
      role: employee.role,
      employeeRole: employee.employeeRole,
      granularPermissions: employee.granularPermissions,
    })
  );

  async function save() {
    try {
      await updatePerms.mutateAsync({ uid: employee.uid, permissions: perms as GranularPermissionsInput });
      toast.success("تم تحديث الصلاحيات");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
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
              {ROLE_LABELS[employee.role]} · الصلاحيات محدودة بسقف الدور مهما اخترت
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[62vh] space-y-4">
          <PermissionSummary
            role={employee.role}
            employeeRole={employee.employeeRole}
            granularPermissions={perms}
            title="بعد الحفظ سيستطيع"
            compact
          />
          <PermissionsEditor value={perms} onChange={setPerms} />
        </div>

        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={save}
            disabled={updatePerms.isPending}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#5B5FEF,#3B82F6)" }}
          >
            {updatePerms.isPending ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}
          </button>
          <button
            onClick={onClose}
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

// ─── Assign team modal ────────────────────────────────────────────────────────

function AssignTeamModal({ employee, teams, onClose }: {
  employee: UserProfile; teams: Team[]; onClose: () => void;
}) {
  const assignTeam = useAssignTeam();
  const [teamId, setTeamId] = useState(employee.teamId ?? "");

  async function save() {
    try {
      await assignTeam.mutateAsync({ uid: employee.uid, teamId: teamId || null });
      toast.success("تم تحديث الفريق");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
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
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="form-input w-full mb-4">
          <option value="">— بدون فريق —</option>
          {teams.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={assignTeam.isPending}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: "#5B5FEF" }}
          >
            {assignTeam.isPending ? "جارٍ…" : "حفظ"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | null
  | { type: "create" }
  | { type: "edit" | "permissions" | "assign-team"; emp: UserProfile }
  | { type: LifecycleAction; emp: UserProfile }
  | { type: "suspend"; emp: UserProfile }
  | { type: "role"; emp: UserProfile; newRole: Role };

export default function UserManagementPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();

  // Three different authorities, deliberately not collapsed into one flag:
  //
  //   mayRead    firestore.rules restricts /users reads to staff. Without it
  //              the page loads and every query comes back denied.
  //   canManage  users.manage — owner-only at the ceiling. Gates creating,
  //              editing, permissions, transfers and archiving, matching what
  //              /api/employees/{create,update,transfer-data,delete} require.
  //   canToggle  users.activateAccounts — the ceiling grants this to admins on
  //              purpose ("day-to-day supervision rather than granting
  //              authority"), and it is what deactivate/reactivate require.
  //
  // Gating the whole page on canManage locked admins out of the suspend and
  // reactivate controls they are explicitly meant to hold.
  const mayRead   = canReadUserDirectory(user);
  const canManage = canManageUsers(user) && mayRead;
  const canToggle = canActivateAccounts(user) && mayRead;
  const canPerms  = canManagePermissions(user);
  const isOwner   = user?.role === "owner";

  useEffect(() => {
    if (!loading && user && !(canManage || canToggle)) router.replace("/");
  }, [user, loading, canManage, canToggle, router]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: users = [], isLoading, isError, refetch } = useUserDirectory(mayRead);
  const { data: teams = [] } = useTeams();

  /**
   * `/users` documents outlive the Auth account they describe — deleting a user
   * in the Firebase console leaves the Firestore row behind, and the directory
   * rendered those leftovers as staff. Only the server can tell the difference.
   * `null` means the check could not run; nothing is hidden in that case,
   * because hiding a real administrator is worse than showing a stale row.
   */
  const [authUids, setAuthUids] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!mayRead) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/users/auth-uids", { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (!cancelled && Array.isArray(body?.uids)) setAuthUids(new Set(body.uids));
      } catch { /* fail open */ }
    })();
    return () => { cancelled = true; };
  }, [mayRead]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [modal, setModal]           = useState<ModalState>(null);
  const [search, setSearch]         = useState("");
  const [jobFilter, setJobFilter]   = useState<EmployeeRole | "">("");
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "">("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");

  // ── Derived ─────────────────────────────────────────────────────────────────
  const [realUsers, ghostCount] = useMemo(() => {
    if (!authUids) return [users, 0];
    const real = users.filter((u) => authUids.has(u.uid));
    return [real, users.length - real.length];
  }, [users, authUids]);

  const statusOf = useMemo(() => {
    const m = new Map<string, AccountStatus>();
    realUsers.forEach((u) => m.set(u.uid, resolveAccountStatus(u)));
    return m;
  }, [realUsers]);

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  const counts = useMemo(() => {
    const c: Record<AccountStatus, number> = {
      active: 0, pending: 0, suspended: 0, disabled: 0, deleted: 0,
    };
    realUsers.forEach((u) => { c[statusOf.get(u.uid) ?? "disabled"]++; });
    return c;
  }, [realUsers, statusOf]);

  /**
   * Archived accounts are hidden until asked for.
   *
   * They are still accounts and still administrable — reactivate restores them —
   * but they are not staff, and letting them accumulate in the default view
   * makes a five-person team look like a twelve-person one. Filtering to
   * "مؤرشف" is how you reach them.
   */
  const filtered = useMemo(() => realUsers.filter((u) => {
    const status = statusOf.get(u.uid) ?? "disabled";
    if (!statusFilter && status === "deleted") return false;
    if (statusFilter && status !== statusFilter) return false;

    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = `${u.name ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (jobFilter  && u.employeeRole !== jobFilter) return false;
    if (roleFilter && u.role !== roleFilter)        return false;
    if (teamFilter && u.teamId !== teamFilter)      return false;
    return true;
  }), [realUsers, statusOf, search, jobFilter, roleFilter, teamFilter, statusFilter]);

  const activeRecipients = useMemo(
    () => realUsers.filter((u) => statusOf.get(u.uid) === "active"),
    [realUsers, statusOf]
  );

  const hasFilters = Boolean(search || jobFilter || teamFilter || statusFilter || roleFilter);

  function clearFilters() {
    setSearch(""); setJobFilter(""); setTeamFilter(""); setStatusFilter(""); setRoleFilter("");
  }

  // ── Row-level authority ─────────────────────────────────────────────────────
  function rowActions(emp: UserProfile): { icon: React.ReactNode; label: string; type: ActionType; color?: string }[] {
    const status = statusOf.get(emp.uid) ?? "disabled";
    const isSelf = emp.uid === user?.uid;
    // canManageRole is the hierarchy check for this particular row; nobody may
    // act on their own account. Each action below then adds the permission its
    // own API route requires, so the menu never offers a call that 403s.
    const ranks  = !isSelf && canManageRole(user?.role ?? "employee", emp.role);

    const items: { icon: React.ReactNode; label: string; type: ActionType; color?: string }[] = [
      { icon: <Eye size={13} />, label: "عرض الملف", type: "view" },
    ];
    if (!ranks) return items;

    if (canManage && status !== "deleted") {
      items.push({ icon: <Edit2 size={13} />, label: "تعديل البيانات", type: "edit" });
      if (canPerms) items.push({ icon: <ShieldCheck size={13} />, label: "الصلاحيات", type: "permissions" });
      items.push({ icon: <Users2 size={13} />, label: "تعيين فريق", type: "assign-team" });
      items.push({ icon: <ArrowLeftRight size={13} />, label: "نقل البيانات", type: "transfer" });
      // Suspension goes through /api/user-operations, which gates every
      // operation on users.manage — not on activateAccounts like the dedicated
      // deactivate route. Listing it under canToggle would offer an admin a
      // button the server answers with 403.
      if (status === "active") {
        items.push({ icon: <PauseCircle size={13} />, label: "تعليق مؤقت", type: "suspend", color: "#EF4444" });
      }
    }

    if (canToggle) {
      if (status === "active") {
        items.push({ icon: <UserMinus size={13} />, label: "تعطيل الحساب", type: "deactivate", color: "#F59E0B" });
      } else if (status === "deleted") {
        items.push({ icon: <ArchiveRestore size={13} />, label: "استعادة من الأرشيف", type: "reactivate", color: "#5B5FEF" });
      } else {
        items.push({ icon: <UserCheck size={13} />, label: "إعادة تفعيل", type: "reactivate", color: "#5B5FEF" });
      }
    }

    // Archiving is owner-only on the server; offering it to anyone else would
    // be a button that always fails.
    if (isOwner && status !== "deleted" && emp.role !== "owner") {
      items.push({ icon: <Trash2 size={13} />, label: "أرشفة الحساب", type: "archive", color: "#EF4444" });
    }
    return items;
  }

  async function suspend(emp: UserProfile) {
    if (!user) return;
    try {
      await permissionService.setStatus(user, emp.uid, emp.role, "suspended");
      toast.success(`تم تعليق حساب ${emp.name}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
    }
    setModal(null);
  }

  async function changeRole(emp: UserProfile, newRole: Role) {
    if (!user) return;
    try {
      await permissionService.setRole(user, emp.uid, emp.role, newRole);
      toast.success(`تم تغيير دور ${emp.name} إلى ${ROLE_LABELS[newRole]}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
    }
    setModal(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const lifecycleModal =
    modal && ["deactivate", "reactivate", "archive", "transfer"].includes(modal.type)
      ? (modal as { type: LifecycleAction; emp: UserProfile })
      : null;

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-5">

          <PageHeader
            title="المستخدمون"
            subtitle={`${realUsers.length} حساب · ${counts.active} نشط`}
            actions={
              <RequirePermission permission={PERM.MANAGE_USERS}>
                <button
                  onClick={() => setModal({ type: "create" })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#5B5FEF,#3B82F6)" }}
                >
                  <Plus size={16} /> إضافة مستخدم
                </button>
              </RequirePermission>
            }
          />

          {/* Lifecycle counters — one strip, clickable as filters. These are
              context for the table, not the subject of the page. */}
          <div
            className="flex flex-wrap divide-x divide-x-reverse overflow-hidden"
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 14, boxShadow: "var(--shadow-card)",
            }}
          >
            <button
              onClick={() => setStatusFilter("")}
              className="flex-1 min-w-24 px-4 py-3 text-center transition-colors hover:bg-slate-50"
              style={{ borderColor: "var(--border)" }}
            >
              <p className="text-lg font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
                {realUsers.length}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>كل الحسابات</p>
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter((prev) => (prev === s ? "" : s))}
                className="flex-1 min-w-24 px-4 py-3 text-center transition-colors hover:bg-slate-50"
                style={{
                  borderColor: "var(--border)",
                  background: statusFilter === s ? `${STATUS_COLOR[s]}10` : undefined,
                }}
              >
                <p className="text-lg font-black tabular-nums" style={{ color: STATUS_COLOR[s] }}>
                  {counts[s]}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {ACCOUNT_STATUS_LABELS[s]}
                </p>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو البريد أو الهاتف…"
                className="form-input w-full pr-9 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | "")}
              className="form-input text-sm w-full sm:w-32"
            >
              <option value="">كل الأدوار</option>
              {(["owner", "admin", "employee"] as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>

            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value as EmployeeRole | "")}
              className="form-input text-sm w-full sm:w-36"
            >
              <option value="">كل الوظائف</option>
              {(Object.keys(JOB_META) as EmployeeRole[]).map((j) => (
                <option key={j} value={j}>{JOB_META[j].label}</option>
              ))}
            </select>

            {teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="form-input text-sm w-full sm:w-36"
              >
                <option value="">كل الفرق</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors hover:bg-slate-50 shrink-0"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <Filter size={12} /> مسح الفلاتر
              </button>
            )}

            <span className="text-xs self-center mr-auto shrink-0" style={{ color: "var(--text-muted)" }}>
              {filtered.length === realUsers.length
                ? `${realUsers.length} حساب`
                : `${filtered.length} من ${realUsers.length}`}
            </span>
          </div>

          {/* Table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            {isLoading && <TableSkeleton rows={7} cols={7} />}

            {isError && !isLoading && (
              <div className="flex flex-col items-center gap-3 py-14 px-5 text-center">
                <AlertTriangle size={28} style={{ color: "#EF4444" }} />
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  تعذّر تحميل قائمة المستخدمين
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 rounded-xl text-white text-sm font-bold"
                  style={{ background: "#5B5FEF" }}
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {!isLoading && !isError && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      {["المستخدم", "الدور", "الوظيفة", "الفريق", "الحالة", "آخر دخول", "الصلاحيات", ""].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {filtered.map((emp) => {
                      const status = statusOf.get(emp.uid) ?? "disabled";
                      const job    = emp.employeeRole ? JOB_META[emp.employeeRole] : null;
                      const team   = emp.teamId ? teamMap[emp.teamId] : null;
                      const pc     = permCount(emp);
                      const isSelf = emp.uid === user?.uid;
                      const mayChangeRole =
                        isOwner && !isSelf && canManageRole(user?.role ?? "employee", emp.role);

                      return (
                        <tr
                          key={emp.uid}
                          className="transition-colors hover:bg-slate-50"
                          style={{ opacity: status === "active" ? 1 : 0.62 }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                                style={{ background: `linear-gradient(135deg,${STATUS_COLOR[status]}cc,${STATUS_COLOR[status]}88)` }}
                              >
                                {initials(emp.name ?? "؟")}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/admin/employees/${emp.uid}`}
                                  className="font-bold text-sm truncate hover:underline"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {emp.name || "—"}
                                </Link>
                                {isSelf && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1.5"
                                    style={{ background: "#EEF0FF", color: "#5B5FEF" }}
                                  >
                                    أنت
                                  </span>
                                )}
                                <p className="text-xs truncate" dir="ltr" style={{ color: "var(--text-muted)" }}>
                                  {emp.email}
                                </p>
                                {emp.phone && (
                                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                                    <Phone size={10} />{emp.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Authority role — one control, not a badge beside a select of the same value */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {mayChangeRole ? (
                              <select
                                value={emp.role}
                                onChange={(e) => setModal({ type: "role", emp, newRole: e.target.value as Role })}
                                aria-label={`دور ${emp.name}`}
                                className={`role-${emp.role}`}
                                style={{ width: "auto", height: 28, padding: "0 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                {(["owner", "admin", "employee"] as Role[])
                                  .filter((r) => canAssignRole(user?.role ?? "employee", r))
                                  .map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                            ) : (
                              <span className={`role-${emp.role}`}>{ROLE_LABELS[emp.role]}</span>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {job ? (
                              <span
                                className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{ background: `${job.color}15`, color: job.color }}
                              >
                                {job.label}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {team ? (
                              <span
                                className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{
                                  background: `${TEAM_COLORS[team.type] ?? "#5B5FEF"}15`,
                                  color: TEAM_COLORS[team.type] ?? "#5B5FEF",
                                }}
                              >
                                {team.name}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <EmployeeStatusBadge active={status === "active"} status={status} />
                          </td>

                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                            {emp.lastLoginAt ? formatDateTime(emp.lastLoginAt) : "لم يسجّل دخولاً"}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                              {pc.active}/{pc.total}
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <ActionsMenu
                              items={rowActions(emp)}
                              onAction={(t) => {
                                if (t === "view") { router.push(`/admin/employees/${emp.uid}`); return; }
                                setModal({ type: t, emp } as ModalState);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <EmptyState
                icon={<Users size={48} />}
                title={hasFilters ? "لا نتائج مطابقة" : "لا يوجد مستخدمون"}
                description={hasFilters ? "جرّب تغيير معايير البحث أو امسح الفلاتر" : "ابدأ بإضافة أول مستخدم"}
                action={
                  hasFilters ? (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-xl border text-sm font-bold"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      مسح الفلاتر
                    </button>
                  ) : canManage ? (
                    <button
                      onClick={() => setModal({ type: "create" })}
                      className="px-4 py-2 rounded-xl text-white text-sm font-bold"
                      style={{ background: "#5B5FEF" }}
                    >
                      إضافة مستخدم
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>

          {/* Hiding rows silently would be its own bug — say what was dropped. */}
          {!isLoading && ghostCount > 0 && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <AlertTriangle size={13} style={{ color: "#F59E0B" }} />
              {ghostCount === 1
                ? "سجل واحد مخفي: ملف تعريف بلا حساب دخول."
                : `${ghostCount} سجلات مخفية: ملفات تعريف بلا حساب دخول.`}
              <span style={{ opacity: 0.75 }}>شغّل <code>npm run audit:accounts</code> لعرضها.</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {(modal?.type === "create" || modal?.type === "edit") && (
          <EmployeeFormModal
            key="form"
            mode={modal.type}
            employee={modal.type === "edit" ? modal.emp : undefined}
            teams={teams}
            onClose={() => setModal(null)}
            onSuccess={toast.success}
          />
        )}
        {modal?.type === "permissions" && (
          <PermissionsModal key="perms" employee={modal.emp} onClose={() => setModal(null)} />
        )}
        {modal?.type === "assign-team" && (
          <AssignTeamModal key="team" employee={modal.emp} teams={teams} onClose={() => setModal(null)} />
        )}
        {lifecycleModal && (
          <LifecycleModal
            key={`lifecycle-${lifecycleModal.type}`}
            action={lifecycleModal.type}
            employee={lifecycleModal.emp}
            recipients={activeRecipients}
            onClose={() => setModal(null)}
            onDone={() => refetch()}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={modal?.type === "suspend"}
        title="تعليق الحساب مؤقتاً"
        description={
          modal?.type === "suspend"
            ? `سيفقد ${modal.emp.name} الوصول للنظام فوراً. التعليق حالة مؤقتة يمكن التراجع عنها بإعادة التفعيل.`
            : undefined
        }
        confirmLabel="تعليق"
        destructive
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "suspend") suspend(modal.emp); }}
      />

      <ConfirmDialog
        open={modal?.type === "role"}
        title="تغيير دور المستخدم"
        description={
          modal?.type === "role"
            ? `تغيير دور «${modal.emp.name}» من ${ROLE_LABELS[modal.emp.role]} إلى ${ROLE_LABELS[modal.newRole]}. ستُعاد صلاحياته إلى الإعدادات الافتراضية للدور الجديد.`
            : undefined
        }
        confirmLabel="تغيير الدور"
        destructive={modal?.type === "role" && modal.newRole === "owner"}
        onClose={() => setModal(null)}
        onConfirm={() => { if (modal?.type === "role") changeRole(modal.emp, modal.newRole); }}
      />
    </ProtectedLayout>
  );
}
