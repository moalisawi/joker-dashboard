"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import ProtectedLayout     from "@/components/layout/ProtectedLayout";
import PermissionsEditor   from "@/components/employees/PermissionsEditor";
import PermissionSummary   from "@/components/employees/PermissionSummary";
import ImpactSummary       from "@/components/employees/ImpactSummary";
import EmployeeFormModal   from "@/components/employees/EmployeeFormModal";
import LifecycleModal, { type LifecycleAction } from "@/components/employees/LifecycleModal";
import EmployeeStatusBadge from "@/components/ui/EmployeeStatusBadge";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import SalesSubscriberList from "@/features/sales/components/SalesSubscriberList";

import { useAuthStore } from "@/store/authStore";
import { useTeams }     from "@/hooks/useTeams";
import {
  useEmployee, useUserDirectory, useUserImpact, useUpdatePermissions, useAssignTeam,
} from "@/features/users/hooks";
import { useUserSessions, useUserAuditTrail } from "@/features/users/useUserActivity";
import { useSalesEmployeeDetail } from "@/features/sales/hooks/useSalesEmployeeDetail";
import type { GranularPermissionsInput } from "@/features/users/schemas";
import {
  effectivePermissions, resolveAccountStatus, ROLE_LABELS, canManageRole,
} from "@/lib/permissions";
import {
  canManageUsers, canManagePermissions, canReadUserDirectory, canViewSessions, canActivateAccounts,
} from "@/lib/permissionGuards";
import { formatNumber, formatDateTime } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { GranularPermissions, EmployeeRole } from "@/types";
import {
  ArrowRight, Users, DollarSign, TrendingUp, Target, UserMinus, UserCheck,
  AlertCircle, Phone, Mail, Building2, CalendarDays, Trash2, Users2,
  CheckCircle2, Edit2, ArrowLeftRight, MonitorSmartphone, ScrollText,
  ShieldCheck, Clock, ArchiveRestore,
} from "lucide-react";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ACC = {
  indigo: "#5B5FEF", amber: "#F59E0B", rose: "#EF4444",
  sky: "#3B82F6", muted: "#9CA3AF",
};

const JOB_META: Record<EmployeeRole, { label: string; color: string }> = {
  owner:       { label: "مالك",      color: ACC.amber  },
  admin:       { label: "مدير",      color: ACC.indigo },
  team_leader: { label: "قائد فريق", color: ACC.sky    },
  sales:       { label: "مبيعات",    color: ACC.indigo },
  followup:    { label: "متابعة",    color: ACC.sky    },
};

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" as const } },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d = ts instanceof Date
    ? ts
    : new Date(((ts as { seconds?: number }).seconds ?? 0) * 1000 || (ts as string));
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Small building blocks ────────────────────────────────────────────────────

function Card({ title, action, children }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      {title && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="text-lg font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string | undefined | null;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="mr-auto text-sm font-semibold" style={{ color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function DangerRow({ title, description, actionLabel, icon, accent, onClick, disabled, note }: {
  title: string; description: string; actionLabel: string; icon: React.ReactNode;
  accent: string; onClick: () => void; disabled?: boolean; note?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: `${accent}06`, border: `1px solid ${accent}28` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold" style={{ color: accent }}>{title}</h3>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p>
          {note && <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>{note}</p>}
        </div>
        <button
          onClick={onClick}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-85 disabled:opacity-40 shrink-0"
          style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
        >
          {icon}{actionLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState = null | { type: "edit" } | { type: LifecycleAction };

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uid    = typeof params.id === "string" ? params.id : "";

  const { user, can } = useAuthStore();
  const canRev    = can("canViewRevenue");
  // Same three-way split as the list page: reading the directory, managing an
  // account (users.manage — owner-only at the ceiling), and switching one on or
  // off (users.activateAccounts — which admins do hold). Each maps to what the
  // corresponding API route requires.
  const mayRead   = canReadUserDirectory(user);
  const canEdit   = canManageUsers(user) && mayRead;
  const canToggle = canActivateAccounts(user) && mayRead;
  const canPerms  = canManagePermissions(user);
  const isOwner   = user?.role === "owner";
  const seeSessions = canViewSessions(user);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: employee, isLoading: empLoading } = useEmployee(uid);
  const { data: directory = [] }                  = useUserDirectory(mayRead);
  const { data: teams = [] }                      = useTeams();
  const { metrics, subscribers, isLoading: metricsLoading } = useSalesEmployeeDetail(uid);
  const { data: impact, isLoading: impactLoading, isError: impactError } = useUserImpact(uid, mayRead);
  const { data: sessions = [], isLoading: sessionsLoading } = useUserSessions(uid, seeSessions);
  const { data: auditTrail = [], isLoading: auditLoading }  = useUserAuditTrail(uid, mayRead);

  // ── Local state ─────────────────────────────────────────────────────────────
  const [localPerms, setLocalPerms] = useState<GranularPermissions | null>(null);
  const [modal, setModal]           = useState<ModalState>(null);

  const updatePermsMut = useUpdatePermissions();
  const assignTeamMut  = useAssignTeam();

  // ── Derived ─────────────────────────────────────────────────────────────────
  const team   = useMemo(() => teams.find((t) => t.id === employee?.teamId) ?? null, [teams, employee?.teamId]);
  const status = employee ? resolveAccountStatus(employee) : "disabled";
  const isSelf = employee?.uid === user?.uid;

  // The hierarchy check for this particular person, and never your own account.
  // Combined with the permission each action needs below.
  const ranks     = Boolean(employee) && !isSelf
    && canManageRole(user?.role ?? "employee", employee?.role ?? "employee");
  const mayManage = ranks && canEdit;
  const mayToggle = ranks && canToggle;
  const mayAct    = mayManage || mayToggle;

  const recipients = useMemo(
    () => directory.filter((u) => resolveAccountStatus(u) === "active"),
    [directory]
  );

  const currentPerms = useMemo<GranularPermissions>(
    () => localPerms ?? effectivePermissions({
      role: employee?.role ?? "employee",
      employeeRole: employee?.employeeRole,
      granularPermissions: employee?.granularPermissions,
    }),
    [localPerms, employee]
  );

  const teamsLed = useMemo(
    () => teams.filter((t) => t.leaderId === uid),
    [teams, uid]
  );

  async function savePermissions() {
    if (!localPerms || !uid) return;
    try {
      await updatePermsMut.mutateAsync({ uid, permissions: localPerms as GranularPermissionsInput });
      toast.success("تم حفظ الصلاحيات");
      setLocalPerms(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل حفظ الصلاحيات");
    }
  }

  async function handleAssignTeam(teamId: string | null) {
    try {
      await assignTeamMut.mutateAsync({ uid, teamId });
      toast.success(teamId ? "تم تعيين الفريق" : "تم إزالة الفريق");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تعيين الفريق");
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!mayRead) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-3" style={{ background: "var(--page-bg)" }}>
          <AlertCircle size={36} style={{ color: ACC.rose }} />
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>غير مصرح بالوصول</p>
          <button onClick={() => router.back()} className="text-sm" style={{ color: "var(--text-muted)" }}>العودة</button>
        </div>
      </ProtectedLayout>
    );
  }

  if (empLoading || metricsLoading) {
    return (
      <ProtectedLayout>
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8 space-y-4">
          {[180, 90, 320, 260].map((h, i) => (
            <div key={i} className="animate-pulse rounded-2xl" style={{ height: h, background: "var(--surface)" }} />
          ))}
        </div>
      </ProtectedLayout>
    );
  }

  if (!employee) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-3" style={{ background: "var(--page-bg)" }}>
          <AlertCircle size={36} style={{ color: ACC.rose }} />
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>المستخدم غير موجود</p>
          <Link href="/admin/employees" className="text-sm" style={{ color: "var(--text-muted)" }}>
            العودة لقائمة المستخدمين
          </Link>
        </div>
      </ProtectedLayout>
    );
  }

  const job      = employee.employeeRole ? JOB_META[employee.employeeRole] : null;
  const isActive = status === "active";
  const convRate = metrics ? Math.round(metrics.conversionRate * 100) : 0;

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8 space-y-5">

          {/* Breadcrumb */}
          <motion.div {...fadeUp} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/admin/employees" className="hover:underline flex items-center gap-1">
              <ArrowRight size={14} /><span>المستخدمون</span>
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>{employee.name}</span>
          </motion.div>

          {/* Identity header */}
          <motion.div
            {...fadeUp}
            className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-start gap-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
              style={{ background: `linear-gradient(135deg,${ACC.indigo},${ACC.sky})` }}
            >
              {initials(employee.name ?? "؟")}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>{employee.name}</h1>
                <EmployeeStatusBadge active={isActive} status={status} />
                {isSelf && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#EEF0FF", color: ACC.indigo }}>
                    أنت
                  </span>
                )}
              </div>
              <p className="text-sm mt-0.5" dir="ltr" style={{ color: "var(--text-muted)" }}>{employee.email}</p>

              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`role-${employee.role}`}>{ROLE_LABELS[employee.role]}</span>
                {job && (
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: `${job.color}15`, color: job.color, border: `1px solid ${job.color}28` }}
                  >
                    {job.label}
                  </span>
                )}
                {employee.department && (
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    {employee.department}
                  </span>
                )}
                {team && (
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: `${ACC.sky}12`, color: ACC.sky, border: `1px solid ${ACC.sky}25` }}
                  >
                    <Users2 size={10} />{team.name}
                  </span>
                )}
              </div>
            </div>

            {mayAct && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {mayManage && (
                  <button
                    onClick={() => setModal({ type: "edit" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    <Edit2 size={13} /> تعديل
                  </button>
                )}
                {mayToggle && (
                <button
                  onClick={() => setModal({ type: isActive ? "deactivate" : "reactivate" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{
                    background: isActive ? `${ACC.amber}15` : `${ACC.indigo}15`,
                    color:      isActive ? ACC.amber : ACC.indigo,
                    border:     `1px solid ${isActive ? ACC.amber : ACC.indigo}28`,
                  }}
                >
                  {isActive ? <UserMinus size={13} /> : <UserCheck size={13} />}
                  {isActive ? "تعطيل" : status === "deleted" ? "استعادة" : "تفعيل"}
                </button>
                )}
              </div>
            )}
          </motion.div>

          {/* KPI strip */}
          {metrics && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="إجمالي المشتركين" value={String(metrics.subscribers)} accent={ACC.indigo} icon={<Users size={16} />} />
              <Kpi label="المشتركون النشطون" value={String(metrics.active)} accent={ACC.sky} icon={<TrendingUp size={16} />} />
              <Kpi
                label="معدل التحويل"
                value={`${convRate}%`}
                accent={convRate >= 70 ? ACC.indigo : convRate >= 40 ? ACC.amber : ACC.rose}
                icon={<Target size={16} />}
              />
              <Kpi
                label="الإيرادات"
                value={canRev ? `$${formatNumber(metrics.revenue, 0)}` : "—"}
                sub={canRev ? `متوسط $${formatNumber(metrics.avgValue, 0)}` : undefined}
                accent={ACC.amber}
                icon={<DollarSign size={16} />}
              />
            </div>
          )}

          {/* Tabs */}
          <motion.div {...fadeUp}>
            <Tabs defaultValue="overview">
              <TabList className="mb-5 flex-wrap">
                <Tab value="overview">نظرة عامة</Tab>
                <Tab value="permissions">الصلاحيات</Tab>
                <Tab value="teams">الفرق</Tab>
                <Tab value="assigned" badge={impact?.transferableTotal}>البيانات المرتبطة</Tab>
                {seeSessions && <Tab value="sessions" badge={sessions.length}>الجلسات</Tab>}
                <Tab value="activity">سجل النشاط</Tab>
                {mayAct && <Tab value="danger">منطقة الخطر</Tab>}
              </TabList>

              {/* ── Overview ── */}
              <TabPanel value="overview">
                <div className="space-y-4">
                  <Card title="بيانات الحساب">
                    <InfoRow icon={<Mail size={14} />}        label="البريد الإلكتروني" value={employee.email} />
                    <InfoRow icon={<Phone size={14} />}       label="رقم الهاتف"        value={employee.phone} />
                    <InfoRow icon={<ShieldCheck size={14} />} label="دور النظام"        value={ROLE_LABELS[employee.role]} />
                    <InfoRow icon={<Users2 size={14} />}      label="الدور الوظيفي"     value={job?.label} />
                    <InfoRow icon={<Building2 size={14} />}   label="القسم"             value={employee.department} />
                    <InfoRow icon={<Users2 size={14} />}      label="الفريق"            value={team?.name} />
                    <InfoRow icon={<CalendarDays size={14} />} label="تاريخ الإنشاء"    value={formatDate(employee.createdAt)} />
                    <InfoRow icon={<Clock size={14} />}       label="آخر تحديث"         value={formatDate(employee.updatedAt)} />
                    <InfoRow
                      icon={<MonitorSmartphone size={14} />}
                      label="آخر دخول"
                      value={employee.lastLoginAt ? formatDateTime(employee.lastLoginAt) : "لم يسجّل دخولاً"}
                    />
                  </Card>

                  {employee.notes && (
                    <Card title="ملاحظات داخلية">
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{employee.notes}</p>
                    </Card>
                  )}
                </div>
              </TabPanel>

              {/* ── Permissions ── */}
              <TabPanel value="permissions">
                <div className="space-y-4">
                  <PermissionSummary
                    role={employee.role}
                    employeeRole={employee.employeeRole}
                    granularPermissions={currentPerms}
                    title={localPerms ? "بعد الحفظ سيستطيع" : "هذا المستخدم يستطيع"}
                    compact
                  />
                  <Card
                    title="الصلاحيات التفصيلية"
                    action={
                      canPerms && localPerms ? (
                        <button
                          onClick={savePermissions}
                          disabled={updatePermsMut.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-85 disabled:opacity-50"
                          style={{ background: ACC.indigo, color: "#fff" }}
                        >
                          <CheckCircle2 size={13} />
                          {updatePermsMut.isPending ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}
                        </button>
                      ) : (
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {canPerms ? "لا تغييرات غير محفوظة" : "عرض فقط"}
                        </span>
                      )
                    }
                  >
                    <PermissionsEditor value={currentPerms} onChange={setLocalPerms} readOnly={!canPerms} />
                    <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      كل صلاحية هنا مطبَّقة فعلياً على الخادم والعميل معاً، ومحدودة بسقف دور
                      «{ROLE_LABELS[employee.role]}» — ما يتجاوز السقف لا يُمنَح مهما فُعِّل.
                    </p>
                  </Card>
                </div>
              </TabPanel>

              {/* ── Teams ── */}
              <TabPanel value="teams">
                <div className="space-y-4">
                  <Card title="عضوية الفريق">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button
                        onClick={() => handleAssignTeam(null)}
                        disabled={!mayManage || assignTeamMut.isPending}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-right transition-all hover:opacity-80 disabled:opacity-40"
                        style={{
                          background: !employee.teamId ? `${ACC.rose}12` : "var(--surface-2)",
                          border: `1px solid ${!employee.teamId ? ACC.rose : "var(--border)"}`,
                          color: !employee.teamId ? ACC.rose : "var(--text-muted)",
                        }}
                      >
                        بدون فريق
                      </button>
                      {teams.filter((t) => t.active).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleAssignTeam(t.id)}
                          disabled={!mayManage || assignTeamMut.isPending}
                          className="px-3 py-2 rounded-xl text-xs font-semibold text-right transition-all hover:opacity-80 disabled:opacity-40"
                          style={{
                            background: employee.teamId === t.id ? `${ACC.sky}12` : "var(--surface-2)",
                            border: `1px solid ${employee.teamId === t.id ? ACC.sky : "var(--border)"}`,
                            color: employee.teamId === t.id ? ACC.sky : "var(--text-secondary)",
                          }}
                        >
                          {t.name}
                          <span className="block text-[10px] opacity-60 mt-0.5">
                            {t.type === "sales" ? "مبيعات" : "متابعة"}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!mayManage && (
                      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                        عرض فقط — لا تملك صلاحية تغيير الفريق لهذا الحساب.
                      </p>
                    )}
                  </Card>

                  <Card title="قيادة الفرق">
                    {teamsLed.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        لا يقود أي فريق حالياً.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {teamsLed.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                          >
                            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t.name}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {t.membersCount} عضو
                            </span>
                          </div>
                        ))}
                        {/* Team leadership is an owner-only write on /teams, not a
                            user-document field — changing it here would fail. */}
                        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          قيادة الفريق تُدار من <Link href="/admin/teams" className="underline">صفحة الفرق</Link> —
                          تعطيل هذا الحساب لا يعيّن قائداً بديلاً تلقائياً.
                        </p>
                      </div>
                    )}
                  </Card>
                </div>
              </TabPanel>

              {/* ── Assigned data ── */}
              <TabPanel value="assigned">
                <div className="space-y-4">
                  <Card
                    title="ما هو مسند لهذا الحساب"
                    action={
                      mayManage && (impact?.transferableTotal ?? 0) > 0 ? (
                        <button
                          onClick={() => setModal({ type: "transfer" })}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-85"
                          style={{ background: `${ACC.sky}12`, color: ACC.sky, border: `1px solid ${ACC.sky}30` }}
                        >
                          <ArrowLeftRight size={13} /> نقل البيانات
                        </button>
                      ) : undefined
                    }
                  >
                    <ImpactSummary impact={impact} loading={impactLoading} error={impactError} />
                  </Card>

                  <Card title={`المشتركون (${subscribers.length})`}>
                    {subscribers.length === 0 ? (
                      <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        لا يوجد مشتركون مسندون لهذا الحساب.
                      </p>
                    ) : (
                      <SalesSubscriberList subscribers={subscribers} canRev={canRev} />
                    )}
                  </Card>
                </div>
              </TabPanel>

              {/* ── Sessions ── */}
              {seeSessions && (
                <TabPanel value="sessions">
                  <Card title="جلسات الدخول">
                    {sessionsLoading ? (
                      <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>جارٍ التحميل…</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        لا توجد جلسات مسجّلة لهذا الحساب.
                      </p>
                    ) : (
                      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                        {sessions.slice(0, 12).map((s) => (
                          <div key={s.id} className="flex items-center gap-3 py-2.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: s.status === "active" ? ACC.indigo : ACC.muted }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                {s.browser} · {s.os}
                                <span className="font-normal mr-2" style={{ color: "var(--text-muted)" }}>
                                  {s.device === "mobile" ? "جوال" : s.device === "tablet" ? "لوحي" : "سطح مكتب"}
                                </span>
                              </p>
                              <p className="text-[11px]" dir="ltr" style={{ color: "var(--text-muted)" }}>
                                {s.ipAddress}{s.city ? ` · ${s.city}` : ""}
                              </p>
                            </div>
                            <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
                              {formatDateTime(s.loginAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </TabPanel>
              )}

              {/* ── Activity ── */}
              <TabPanel value="activity">
                <Card title="ما جرى على هذا الحساب">
                  {auditLoading ? (
                    <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>جارٍ التحميل…</p>
                  ) : auditTrail.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8" style={{ color: "var(--text-muted)" }}>
                      <ScrollText size={26} />
                      <p className="text-sm">لا توجد عمليات مسجّلة على هذا الحساب بعد.</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {auditTrail.slice(0, 20).map((log, i) => (
                        <div key={log.id ?? i} className="flex items-start gap-3 py-2.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                            style={{
                              background: log.severity === "critical" ? ACC.rose
                                : log.severity === "warning" ? ACC.amber : ACC.indigo,
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                              {log.description || log.action}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {log.actorName ?? "النظام"}
                            </p>
                          </div>
                          <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
                            {log.createdAt ? formatDateTime(log.createdAt) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                    السجل الكامل لكل العمليات متاح في <Link href="/logs" className="underline">سجل العمليات</Link>.
                  </p>
                </Card>
              </TabPanel>

              {/* ── Danger zone ── */}
              {mayAct && (
                <TabPanel value="danger">
                  <div className="space-y-3">
                    {mayManage && (impact?.transferableTotal ?? 0) > 0 && (
                      <DangerRow
                        title="نقل البيانات المرتبطة"
                        description={`${impact?.transferableTotal} سجلاً مسند لهذا الحساب. انقلها لموظف نشط قبل تعطيله أو أرشفته، وإلا بقيت خارج قوائم عمل الجميع.`}
                        actionLabel="نقل البيانات"
                        icon={<ArrowLeftRight size={13} />}
                        accent={ACC.sky}
                        onClick={() => setModal({ type: "transfer" })}
                      />
                    )}

                    {mayToggle && (isActive ? (
                      <DangerRow
                        title="تعطيل الحساب"
                        description="يفقد الوصول فوراً وتُلغى جلساته المفتوحة. لا يُحذف شيء ويمكن إعادة التفعيل في أي وقت."
                        actionLabel="تعطيل الحساب"
                        icon={<UserMinus size={13} />}
                        accent={ACC.amber}
                        onClick={() => setModal({ type: "deactivate" })}
                      />
                    ) : (
                      <DangerRow
                        title={status === "deleted" ? "استعادة الحساب من الأرشيف" : "إعادة تفعيل الحساب"}
                        description="يستعيد الوصول وفق صلاحياته المحفوظة. البيانات المرتبطة تبقى كما هي."
                        actionLabel={status === "deleted" ? "استعادة" : "إعادة التفعيل"}
                        icon={status === "deleted" ? <ArchiveRestore size={13} /> : <UserCheck size={13} />}
                        accent={ACC.indigo}
                        onClick={() => setModal({ type: "reactivate" })}
                      />
                    ))}

                    {isOwner && employee.role !== "owner" && status !== "deleted" && (
                      <DangerRow
                        title="أرشفة الحساب"
                        description="إغلاق نهائي للاستخدام مع الاحتفاظ بالسجل: الاسم يظل ظاهراً على كل مشترك ودفعة سابقة، ولا يُحذف أي شيء من قاعدة البيانات."
                        note="لا يوجد حذف نهائي في هذا النظام — الأرشفة قابلة للتراجع من هذه الصفحة نفسها."
                        actionLabel="أرشفة الحساب"
                        icon={<Trash2 size={13} />}
                        accent={ACC.rose}
                        onClick={() => setModal({ type: "archive" })}
                      />
                    )}

                    {employee.role === "owner" && (
                      <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
                        حسابات المالك لا يمكن أرشفتها — النظام يرفض ذلك على الخادم أيضاً.
                      </p>
                    )}
                  </div>
                </TabPanel>
              )}
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === "edit" && (
          <EmployeeFormModal
            key="edit"
            mode="edit"
            employee={employee}
            teams={teams}
            onClose={() => setModal(null)}
            onSuccess={toast.success}
          />
        )}
        {modal && modal.type !== "edit" && (
          <LifecycleModal
            key={`lifecycle-${modal.type}`}
            action={modal.type}
            employee={employee}
            recipients={recipients}
            onClose={() => setModal(null)}
            onDone={() => { if (modal.type === "archive") router.push("/admin/employees"); }}
          />
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
