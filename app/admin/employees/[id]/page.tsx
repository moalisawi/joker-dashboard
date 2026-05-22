"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import ProtectedLayout    from "@/components/layout/ProtectedLayout";
import PermissionsEditor  from "@/components/employees/PermissionsEditor";
import EmployeeStatusBadge from "@/components/ui/EmployeeStatusBadge";
import ConfirmDialog      from "@/components/ui/ConfirmDialog";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import SalesMonthlyTrendChart from "@/features/sales/components/SalesMonthlyTrendChart";
import SalesSubscriberList    from "@/features/sales/components/SalesSubscriberList";

import { useAuthStore } from "@/store/authStore";
import { useTeams }     from "@/hooks/useTeams";
import {
  useEmployee,
  useDeactivateEmployee,
  useDeleteEmployee,
  useUpdatePermissions,
  useAssignTeam,
} from "@/features/users/hooks";
import { callUserOperation } from "@/lib/clientUserOperations";
import { useSalesEmployeeDetail } from "@/features/sales/hooks/useSalesEmployeeDetail";
import { getDefaultGranularPermissions } from "@/lib/permissions";
import { canManageUsers, canManagePermissions } from "@/lib/permissionGuards";
import { formatNumber } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { GranularPermissions, EmployeeRole, EmployeeDepartment } from "@/types";
import {
  ArrowRight, Users, DollarSign, TrendingUp, RefreshCw, Target,
  ShieldCheck, UserMinus, UserCheck, AlertCircle, Phone, Mail,
  Building2, CalendarDays, Trash2, Users2, CheckCircle2,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACC = {
  indigo:  "#5B5FEF",
  emerald: "#5B5FEF",
  amber:   "#F59E0B",
  rose:    "#EF4444",
  sky:     "#3B82F6",
  purple:  "#3B82F6",
};

const GRADIENTS = [
  `linear-gradient(135deg,${ACC.indigo},${ACC.purple})`,
  `linear-gradient(135deg,${ACC.emerald},${ACC.sky})`,
  `linear-gradient(135deg,${ACC.amber},${ACC.rose})`,
  `linear-gradient(135deg,${ACC.purple},${ACC.rose})`,
  `linear-gradient(135deg,${ACC.sky},${ACC.indigo})`,
];

const ROLE_META: Record<EmployeeRole, { label: string; color: string }> = {
  owner:       { label: "مالك",       color: ACC.amber  },
  admin:       { label: "مدير",       color: ACC.indigo },
  team_leader: { label: "قائد فريق", color: ACC.purple },
  sales:       { label: "مبيعات",    color: ACC.emerald },
  followup:    { label: "متابعة",    color: ACC.sky     },
};

const tran    = { duration: 0.28, ease: "easeOut" } as const;
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: tran } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

function avatarGradient(uid: string) {
  const idx = uid.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d = ts instanceof Date ? ts : new Date((ts as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <motion.div {...fadeUp}
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide truncate"
          style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-lg font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

function InfoRow({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string | undefined | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="mr-auto text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uid    = typeof params.id === "string" ? params.id : "";

  const { user, can } = useAuthStore();
  const canRev        = can("canViewRevenue");
  const canEdit       = canManageUsers(user);
  const canPerms      = canManagePermissions(user);
  const isOwner       = user?.role === "owner";
  const canAccess     = user?.role === "owner" || user?.role === "admin";

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: employee, isLoading: empLoading } = useEmployee(uid);
  const { metrics, subscribers, isLoading: metricsLoading } = useSalesEmployeeDetail(uid);
  const { data: teams = [] } = useTeams();

  // ── Local state ─────────────────────────────────────────────────────────────
  const [localPerms, setLocalPerms] = useState<GranularPermissions | null>(null);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showDelete,     setShowDelete]     = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updatePermsMut  = useUpdatePermissions();
  const deactivateMut   = useDeactivateEmployee();
  const deleteMut       = useDeleteEmployee();
  const assignTeamMut   = useAssignTeam();

  // ── Derived ─────────────────────────────────────────────────────────────────
  const team = useMemo(
    () => teams.find((t) => t.id === employee?.teamId) ?? null,
    [teams, employee?.teamId],
  );

  const currentPerms = useMemo(
    () => localPerms ?? employee?.granularPermissions ?? getDefaultGranularPermissions(employee?.role ?? "employee"),
    [localPerms, employee],
  );

  const isLoading = empLoading || metricsLoading;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function savePermissions() {
    if (!localPerms || !uid) return;
    try {
      await updatePermsMut.mutateAsync({ uid, permissions: localPerms as never });
      toast.success("تم حفظ الصلاحيات");
      setLocalPerms(null);
    } catch {
      toast.error("فشل حفظ الصلاحيات");
    }
  }

  async function handleDeactivate() {
    if (!employee || !user) return;
    try {
      if (isActive) {
        await deactivateMut.mutateAsync({ uid });
        toast.success("تم تعطيل الحساب");
      } else {
        await callUserOperation("toggleEmployee", { uid, active: true });
        toast.success("تم تفعيل الحساب");
      }
      setShowDeactivate(false);
    } catch {
      toast.error("فشلت العملية");
    }
  }

  async function handleDelete() {
    try {
      await deleteMut.mutateAsync(uid);
      toast.success("تم حذف الموظف");
      router.push("/admin/employees");
    } catch {
      toast.error("فشل الحذف");
    }
  }

  async function handleAssignTeam(teamId: string | null) {
    try {
      await assignTeamMut.mutateAsync({ uid, teamId });
      toast.success(teamId ? "تم تعيين الفريق" : "تم إزالة الفريق");
      setShowTeamPicker(false);
    } catch {
      toast.error("فشل تعيين الفريق");
    }
  }

  // ── Auth guard ───────────────────────────────────────────────────────────────
  if (!canAccess) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-3"
          style={{ background: "var(--page-bg)" }}>
          <AlertCircle size={36} style={{ color: ACC.rose }} />
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>غير مصرح بالوصول</p>
          <button onClick={() => router.back()} className="text-sm" style={{ color: "var(--text-muted)" }}>
            العودة
          </button>
        </div>
      </ProtectedLayout>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ProtectedLayout>
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8 space-y-4">
          {[200, 100, 300, 400].map((h, i) => (
            <div key={i} className="animate-pulse rounded-2xl"
              style={{ height: h, background: "var(--surface)" }} />
          ))}
        </div>
      </ProtectedLayout>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!employee) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-3"
          style={{ background: "var(--page-bg)" }}>
          <AlertCircle size={36} style={{ color: ACC.rose }} />
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>الموظف غير موجود</p>
          <button onClick={() => router.back()} className="text-sm" style={{ color: "var(--text-muted)" }}>
            العودة
          </button>
        </div>
      </ProtectedLayout>
    );
  }

  const roleMeta  = ROLE_META[employee.employeeRole ?? "sales"] ?? ROLE_META.sales;
  const isActive  = employee.status === "active" || employee.active;
  const grad      = avatarGradient(uid);
  const convRate  = metrics ? Math.round(metrics.conversionRate * 100) : 0;

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
          <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-5">

            {/* ── Breadcrumb ── */}
            <motion.div {...fadeUp} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <Link href="/admin/employees" className="hover:underline flex items-center gap-1">
                <ArrowRight size={14} />
                <span>الموظفون</span>
              </Link>
              <span>/</span>
              <span style={{ color: "var(--text-primary)" }}>{employee.name}</span>
            </motion.div>

            {/* ── Profile header card ── */}
            <motion.div {...fadeUp}
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="p-6 flex flex-col sm:flex-row sm:items-start gap-5">

                {/* Avatar */}
                <div className="h-20 w-20 rounded-2xl flex items-center justify-center
                  text-2xl font-black text-white shrink-0"
                  style={{ background: grad }}>
                  {initials(employee.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
                      {employee.name}
                    </h1>
                    <EmployeeStatusBadge active={isActive} status={employee.status} />
                  </div>

                  <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {employee.email}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {/* Role badge */}
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: `${roleMeta.color}15`, color: roleMeta.color, border: `1px solid ${roleMeta.color}28` }}>
                      {roleMeta.label}
                    </span>

                    {/* Department */}
                    {employee.department && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {employee.department}
                      </span>
                    )}

                    {/* Team */}
                    {team && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                        style={{ background: `${ACC.purple}12`, color: ACC.purple, border: `1px solid ${ACC.purple}25` }}>
                        <Users2 size={10} />
                        {team.name}
                      </span>
                    )}

                    {/* Active subs badge */}
                    {metrics && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: `${ACC.emerald}12`, color: ACC.emerald, border: `1px solid ${ACC.emerald}25` }}>
                        {metrics.active} مشترك نشط
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions (top-right) */}
                {canEdit && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => setShowDeactivate(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                      style={{
                        background: isActive ? `${ACC.amber}15` : `${ACC.emerald}15`,
                        color:      isActive ? ACC.amber : ACC.emerald,
                        border:     `1px solid ${isActive ? ACC.amber : ACC.emerald}28`,
                      }}>
                      {isActive ? <UserMinus size={13} /> : <UserCheck size={13} />}
                      {isActive ? "تعطيل" : "تفعيل"}
                    </button>

                    {isOwner && (
                      <button
                        onClick={() => setShowDelete(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                        style={{ background: `${ACC.rose}12`, color: ACC.rose, border: `1px solid ${ACC.rose}25` }}>
                        <Trash2 size={13} />
                        حذف
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── KPI strip ── */}
            {metrics && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Kpi label="إجمالي المشتركين" value={String(metrics.subscribers)}
                  accent={ACC.indigo} icon={<Users size={16} />} />
                <Kpi label="المشتركون النشطون" value={String(metrics.active)}
                  accent={ACC.emerald} icon={<TrendingUp size={16} />} />
                <Kpi label="معدل التحويل"
                  value={`${convRate}%`}
                  accent={convRate >= 70 ? ACC.emerald : convRate >= 40 ? ACC.amber : ACC.rose}
                  icon={<Target size={16} />} />
                <Kpi label="الإيرادات"
                  value={canRev ? `$${formatNumber(metrics.revenue, 0)}` : "—"}
                  sub={canRev ? `متوسط $${formatNumber(metrics.avgValue, 0)}` : undefined}
                  accent={ACC.amber} icon={<DollarSign size={16} />} />
                <Kpi label="التجديدات" value={String(metrics.renewals)}
                  accent={ACC.rose} icon={<RefreshCw size={16} />} />
              </div>
            )}

            {/* ── Tabs ── */}
            <motion.div {...fadeUp}>
              <Tabs defaultValue="overview">
                <TabList className="mb-5">
                  <Tab value="overview">نظرة عامة</Tab>
                  <Tab value="subscribers" badge={subscribers.length}>المشتركون</Tab>
                  <Tab value="permissions">الصلاحيات</Tab>
                  <Tab value="actions">الإجراءات</Tab>
                </TabList>

                {/* ── TAB: Overview ── */}
                <TabPanel value="overview">
                  <div className="space-y-4">

                    {/* Chart */}
                    {metrics && metrics.trend.length > 0 && (
                      <div className="rounded-2xl overflow-hidden"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            الاكتساب الشهري — آخر 6 أشهر
                          </h2>
                        </div>
                        <div className="p-5">
                          <SalesMonthlyTrendChart data={metrics.trend} canRev={canRev} height={220} />
                        </div>
                      </div>
                    )}

                    {/* Conversion bar */}
                    {metrics && (
                      <div className="rounded-2xl p-5"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>معدل التحويل</h2>
                          <span className="text-lg font-black"
                            style={{ color: convRate >= 70 ? ACC.emerald : convRate >= 40 ? ACC.amber : ACC.rose }}>
                            {convRate}%
                          </span>
                        </div>
                        <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, convRate)}%`,
                              background: convRate >= 70 ? ACC.emerald : convRate >= 40 ? ACC.amber : ACC.rose,
                            }} />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[11px]"
                          style={{ color: "var(--text-muted)" }}>
                          <span>{metrics.active} نشط من {metrics.subscribers}</span>
                          <span>{metrics.refunds} استرداد</span>
                        </div>
                      </div>
                    )}

                    {/* Employee info card */}
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                      <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>بيانات الموظف</h2>
                      </div>
                      <div className="px-5 py-1">
                        <InfoRow icon={<Mail size={14} />}   label="البريد الإلكتروني" value={employee.email} />
                        <InfoRow icon={<Phone size={14} />}  label="رقم الهاتف"        value={employee.phone} />
                        <InfoRow icon={<Building2 size={14} />} label="القسم"          value={employee.department} />
                        <InfoRow icon={<Users2 size={14} />} label="الفريق"            value={team?.name} />
                        <InfoRow icon={<CalendarDays size={14} />} label="تاريخ الإضافة" value={formatDate(employee.createdAt)} />
                        {employee.notes && (
                          <div className="py-2.5 border-t" style={{ borderColor: "var(--border)" }}>
                            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>ملاحظات</p>
                            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{employee.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabPanel>

                {/* ── TAB: Subscribers ── */}
                <TabPanel value="subscribers">
                  {subscribers.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16"
                      style={{ color: "var(--text-muted)" }}>
                      <Users size={32} />
                      <p className="text-sm font-semibold">لا يوجد مشتركون مسندون لهذا الموظف</p>
                    </div>
                  ) : (
                    <SalesSubscriberList subscribers={subscribers} canRev={canRev} />
                  )}
                </TabPanel>

                {/* ── TAB: Permissions ── */}
                <TabPanel value="permissions">
                  <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                      <div className="px-5 py-3.5 border-b flex items-center justify-between"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                        <div>
                          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>الصلاحيات</h2>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {canPerms ? "يمكنك تعديل الصلاحيات وحفظها" : "عرض فقط — لا تملك صلاحية التعديل"}
                          </p>
                        </div>
                        {canPerms && localPerms && (
                          <button
                            onClick={savePermissions}
                            disabled={updatePermsMut.isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-50"
                            style={{ background: ACC.indigo, color: "#fff" }}>
                            <CheckCircle2 size={13} />
                            {updatePermsMut.isPending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}
                          </button>
                        )}
                      </div>
                      <div className="p-5">
                        <PermissionsEditor
                          value={currentPerms}
                          onChange={(v) => setLocalPerms(v)}
                          readOnly={!canPerms}
                        />
                      </div>
                    </div>
                  </div>
                </TabPanel>

                {/* ── TAB: Actions ── */}
                <TabPanel value="actions">
                  <div className="space-y-3">

                    {/* Status toggle */}
                    {canEdit && (
                      <div className="rounded-2xl p-5"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                              {isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                            </h3>
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              {isActive
                                ? "إيقاف وصول الموظف للنظام مؤقتاً. يمكن إعادة التفعيل في أي وقت."
                                : "إعادة تفعيل حساب الموظف ومنحه وصولاً كاملاً وفق صلاحياته."}
                            </p>
                          </div>
                          <button
                            onClick={() => setShowDeactivate(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 shrink-0"
                            style={{
                              background: isActive ? `${ACC.amber}15` : `${ACC.emerald}15`,
                              color:      isActive ? ACC.amber : ACC.emerald,
                              border:     `1px solid ${isActive ? ACC.amber : ACC.emerald}28`,
                            }}>
                            {isActive ? <UserMinus size={13} /> : <UserCheck size={13} />}
                            {isActive ? "تعطيل الحساب" : "إعادة التفعيل"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Team assignment */}
                    {canEdit && (
                      <div className="rounded-2xl p-5"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>الفريق</h3>
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              {team ? `الفريق الحالي: ${team.name}` : "لم يُعيَّن لفريق بعد"}
                            </p>
                          </div>
                          <button
                            onClick={() => setShowTeamPicker((v) => !v)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 shrink-0"
                            style={{ background: `${ACC.purple}12`, color: ACC.purple, border: `1px solid ${ACC.purple}25` }}>
                            <Users2 size={13} />
                            {showTeamPicker ? "إغلاق" : "تغيير الفريق"}
                          </button>
                        </div>

                        <AnimatePresence>
                          {showTeamPicker && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden">
                              <div className="pt-3 border-t grid grid-cols-2 gap-2 sm:grid-cols-3"
                                style={{ borderColor: "var(--border)" }}>
                                {/* No team option */}
                                <button
                                  onClick={() => handleAssignTeam(null)}
                                  disabled={assignTeamMut.isPending}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold text-right transition-all hover:opacity-80 disabled:opacity-40"
                                  style={{
                                    background: !employee.teamId ? `${ACC.rose}12` : "var(--surface-2)",
                                    border: `1px solid ${!employee.teamId ? ACC.rose : "var(--border)"}`,
                                    color: !employee.teamId ? ACC.rose : "var(--text-muted)",
                                  }}>
                                  بدون فريق
                                </button>
                                {teams.filter((t) => t.active).map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => handleAssignTeam(t.id)}
                                    disabled={assignTeamMut.isPending}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold text-right transition-all hover:opacity-80 disabled:opacity-40"
                                    style={{
                                      background: employee.teamId === t.id ? `${ACC.purple}12` : "var(--surface-2)",
                                      border: `1px solid ${employee.teamId === t.id ? ACC.purple : "var(--border)"}`,
                                      color: employee.teamId === t.id ? ACC.purple : "var(--text-secondary)",
                                    }}>
                                    {t.name}
                                    <span className="block text-[10px] opacity-60 mt-0.5">
                                      {t.type === "sales" ? "مبيعات" : "متابعة"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Danger zone */}
                    {isOwner && (
                      <div className="rounded-2xl p-5"
                        style={{ background: `${ACC.rose}08`, border: `1px solid ${ACC.rose}28`, boxShadow: "var(--shadow-card)" }}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-bold" style={{ color: ACC.rose }}>حذف الموظف</h3>
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              إجراء لا يمكن التراجع عنه. سيُحذف الحساب نهائياً من النظام.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowDelete(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 shrink-0"
                            style={{ background: ACC.rose, color: "#fff" }}>
                            <Trash2 size={13} />
                            حذف نهائي
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sales page link */}
                    <div className="rounded-2xl p-5"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>صفحة الأداء التفصيلية</h3>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            عرض أداء المبيعات مع رسم بياني شهري كامل
                          </p>
                        </div>
                        <Link href={`/sales/${uid}`}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                          style={{ background: `${ACC.indigo}12`, color: ACC.indigo, border: `1px solid ${ACC.indigo}25` }}>
                          <TrendingUp size={13} />
                          فتح
                        </Link>
                      </div>
                    </div>
                  </div>
                </TabPanel>

              </Tabs>
            </motion.div>

          </motion.div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={showDeactivate}
        title={isActive ? "تعطيل حساب الموظف" : "تفعيل حساب الموظف"}
        description={
          isActive
            ? `هل تريد تعطيل حساب "${employee.name}"؟ لن يتمكن من تسجيل الدخول حتى تُعيد تفعيله.`
            : `هل تريد إعادة تفعيل حساب "${employee.name}"؟`
        }
        confirmLabel={isActive ? "تعطيل" : "تفعيل"}
        destructive={isActive}
        loading={deactivateMut.isPending}
        onConfirm={handleDeactivate}
        onClose={() => setShowDeactivate(false)}
      />

      <ConfirmDialog
        open={showDelete}
        title="حذف الموظف نهائياً"
        description={`هل أنت متأكد من حذف "${employee.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="حذف"
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      />
    </ProtectedLayout>
  );
}
