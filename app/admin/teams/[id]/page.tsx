"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import ProtectedLayout  from "@/components/layout/ProtectedLayout";
import TableSkeleton    from "@/components/ui/TableSkeleton";
import EmptyState       from "@/components/ui/EmptyState";

import { useAuthStore }    from "@/store/authStore";
import { useThemeStore }   from "@/store/themeStore";
import { useTeamDetail, useTeamMembers } from "@/features/teams";
import { useUpdateEmployee, useAssignTeam } from "@/features/users/hooks";
import { useSubscribers }  from "@/hooks/useSubscribers";
import { canManageUsers }  from "@/lib/permissionGuards";
import { auditService }    from "@/services/audit.service";
import { formatNumber }    from "@/lib/utils";
import type { UserProfile, Subscriber } from "@/types";
import {
  ArrowRight, Users2, Briefcase, User, Phone, Clock,
  ShieldCheck, ShieldOff, UserMinus, CheckCircle2, XCircle,
  Crown, TrendingUp, DollarSign, Search,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string }> = {
  sales:    { label: "مبيعات",   color: "#10b981" },
  followup: { label: "متابعة",  color: "#8b5cf6" },
  admin:    { label: "مدير",    color: "#6366f1" },
  owner:    { label: "مالك",    color: "#f59e0b" },
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  sales:     { label: "مبيعات", color: "#10b981" },
  nutrition: { label: "تغذية",  color: "#8b5cf6" },
};

function permSummary(emp: UserProfile): string {
  if (emp.role === "owner") return "صلاحيات كاملة";
  if (!emp.granularPermissions) {
    if (emp.employeeRole === "admin") return "مدير";
    return "افتراضي";
  }
  const gp = emp.granularPermissions;
  const labels: string[] = [];
  if (gp.subscribers?.edit)    labels.push("تعديل المشتركين");
  if (gp.payments?.refund)     labels.push("استرداد");
  if (gp.analytics?.view)      labels.push("تقارير");
  if (gp.users?.manage)        labels.push("إدارة موظفين");
  return labels.length ? labels.join("، ") : "قراءة فقط";
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d = typeof ts === "object" && "toDate" in (ts as object)
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string);
  return d.toLocaleDateString("ar-EG", { day:"numeric", month:"short", year:"numeric" });
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({
  emp, canEdit, isOwner,
  onRemove,
}: {
  emp: UserProfile;
  canEdit: boolean;
  isOwner: boolean;
  onRemove: (emp: UserProfile) => void;
}) {
  const roleMeta = ROLE_META[emp.employeeRole ?? ""] ?? { label: emp.employeeRole ?? "—", color: "#94a3b8" };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Name + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${roleMeta.color}cc,${roleMeta.color}66)` }}>
            {(emp.name ?? emp.email ?? "?")[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emp.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: `${roleMeta.color}15`, color: roleMeta.color }}>
          {roleMeta.label}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {emp.active ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 size={12}/> نشط
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
            <XCircle size={12}/> معطّل
          </span>
        )}
      </td>

      {/* Phone */}
      <td className="px-4 py-3">
        <span className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {emp.phone ?? "—"}
        </span>
      </td>

      {/* Permissions */}
      <td className="px-4 py-3 max-w-[180px]">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {permSummary(emp)}
        </span>
      </td>

      {/* Created at */}
      <td className="px-4 py-3">
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {formatDate(emp.createdAt)}
        </span>
      </td>

      {/* Actions */}
      {canEdit && (
        <td className="px-4 py-3">
          {isOwner && (
            <button
              onClick={() => onRemove(emp)}
              title="إزالة من الفريق"
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "#f43f5e12", color: "#f43f5e" }}
            >
              <UserMinus size={13}/>
            </button>
          )}
        </td>
      )}
    </motion.tr>
  );
}

// ─── Subscribers Section ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  "نشط":           "#10b981",
  "ينتهي قريباً":  "#f59e0b",
  "منتهي":         "#f43f5e",
  "موقوف":         "#f97316",
  "متجمد":         "#38bdf8",
  "منسحب":         "#94a3b8",
};

function SubscribersSection({ teamName, canRev }: { teamName: string; canRev: boolean }) {
  const { subscribers, loading } = useSubscribers();
  const [search, setSearch] = useState("");

  const teamSubs = useMemo(
    () => subscribers.filter((s) => s.team === teamName),
    [subscribers, teamName]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return teamSubs;
    return teamSubs.filter(
      (s) => s.name.toLowerCase().includes(q) || s.phone?.includes(q)
    );
  }, [teamSubs, search]);

  const revenue  = teamSubs.reduce((sum, s) => sum + (s.netAmountUSD || 0), 0);
  const active   = teamSubs.filter((s) => s.status === "نشط").length;
  const expiring = teamSubs.filter((s) => s.status === "ينتهي قريباً").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>مشتركو الفريق</h2>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "#6366f115", color: "#6366f1" }}>
          {teamSubs.length} مشترك
        </span>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { label: "الإجمالي",       value: teamSubs.length,            color: "#6366f1" },
          { label: "نشطون",          value: active,                     color: "#10b981" },
          { label: "ينتهي قريباً",   value: expiring,                   color: "#f59e0b" },
          { label: "الإيراد",        value: canRev ? `$${formatNumber(revenue, 0)}` : "—", color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-lg font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="relative">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40"/>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="form-input w-full pr-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={<User size={40}/>}
            title={search ? "لا توجد نتائج" : "لا يوجد مشتركون في هذا الفريق"}
            description={search ? "جرّب تغيير كلمة البحث" : "المشتركون المرتبطون بهذا الفريق سيظهرون هنا"}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                {["الاسم", "الحالة", "الباقة", "الأيام المتبقية", "أقنعه", ...(canRev ? ["الإيراد"] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    {s.phone && (
                      <p className="text-xs mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }} dir="ltr">
                        {s.dialCode} {s.phone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: `${STATUS_COLOR[s.status] ?? "#94a3b8"}18`, color: STATUS_COLOR[s.status] ?? "#94a3b8" }}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.package === "ذهبية" ? "pkg-gold" : "pkg-silver"}`}>
                      {s.package}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm tabular-nums font-semibold"
                      style={{ color: s.daysRemaining <= 7 ? "#f43f5e" : s.daysRemaining <= 30 ? "#f59e0b" : "var(--text-primary)" }}>
                      {s.daysRemaining > 0 ? `${s.daysRemaining} يوم` : "منتهي"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.convincedBy || "—"}</span>
                  </td>
                  {canRev && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-bold tabular-nums text-emerald-500">
                        ${formatNumber(s.netAmountUSD, 0)}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { user }  = useAuthStore();
  const { dark }  = useThemeStore();
  const { loading } = useAuthStore();

  // Redirect non-managers
  useEffect(() => {
    if (!loading && user && !canManageUsers(user)) router.replace("/");
  }, [user, loading, router]);

  const { data: team, isLoading: teamLoading } = useTeamDetail(id);
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(id);
  const assignTeamMut = useAssignTeam();

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [removing, setRemoving] = useState<UserProfile | null>(null);

  const canEdit  = canManageUsers(user);
  const isOwner  = user?.role === "owner";
  const canRev   = user?.role === "owner" || user?.granularPermissions?.analytics?.view === true;

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  async function handleRemoveMember(emp: UserProfile) {
    try {
      await assignTeamMut.mutateAsync({ uid: emp.uid, teamId: null });
      if (user) {
        auditService.track({
          actor: user,
          action: "employee_team_changed",
          entity: "user",
          entityId: emp.uid,
          entityName: emp.name,
          metadata: { fromTeamId: id, toTeamId: null },
          tags: ["team", "employee"],
        }).catch(() => undefined);
      }
      showToast(`تمت إزالة ${emp.name} من الفريق`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "حدث خطأ", false);
    } finally {
      setRemoving(null);
    }
  }

  const typeMeta = TYPE_META[team?.type ?? ""] ?? { label: "—", color: "#94a3b8" };

  const stats = {
    total:   members.length,
    active:  members.filter((m) => m.active).length,
    sales:   members.filter((m) => m.employeeRole === "sales").length,
    follow:  members.filter((m) => m.employeeRole === "followup").length,
  };

  return (
    <ProtectedLayout>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-lg font-bold text-sm text-white flex items-center gap-2"
            style={{ background: toast.ok ? "#10b981" : "#f43f5e" }}
          >
            {toast.ok ? "✓" : "✕"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/admin/teams" className="hover:underline" style={{ color: "var(--text-secondary)" }}>
              إدارة الفرق
            </Link>
            <ArrowRight size={13}/>
            <span style={{ color: "var(--text-primary)" }}>
              {teamLoading ? "..." : (team?.name ?? "فريق غير معروف")}
            </span>
          </div>

          {teamLoading ? (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <TableSkeleton rows={4} cols={4}/>
            </div>
          ) : !team ? (
            <EmptyState icon={<Users2 size={48}/>} title="الفريق غير موجود"
              description="تحقق من الرابط أو عُد إلى قائمة الفرق"/>
          ) : (
            <>
              {/* Team header card */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="h-1.5" style={{ background: `linear-gradient(90deg,${typeMeta.color}cc,${typeMeta.color}44)` }}/>
                <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${typeMeta.color}18`, border: `1px solid ${typeMeta.color}28` }}>
                    {team.type === "sales"
                      ? <Briefcase size={22} style={{ color: typeMeta.color }}/>
                      : <Users2    size={22} style={{ color: typeMeta.color }}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                        {team.name}
                      </h1>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: team.active ? "#10b98118" : "#94a3b818", color: team.active ? "#10b981" : "#94a3b8" }}>
                        {team.active ? "نشط" : "معطّل"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${typeMeta.color}15`, color: typeMeta.color }}>
                      {team.type === "sales" ? <Briefcase size={11}/> : <Users2 size={11}/>}
                      {typeMeta.label}
                    </span>
                  </div>
                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-center">
                    {[
                      { label: "أعضاء",  value: stats.total,  color: typeMeta.color },
                      { label: "نشطون",  value: stats.active, color: "#10b981" },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "إجمالي الأعضاء", value: stats.total,  color: typeMeta.color, icon: <User size={14}/> },
                  { label: "نشطون",           value: stats.active, color: "#10b981",      icon: <CheckCircle2 size={14}/> },
                  { label: "مبيعات",          value: stats.sales,  color: "#f59e0b",      icon: <TrendingUp size={14}/> },
                  { label: "متابعة",          value: stats.follow, color: "#8b5cf6",      icon: <ShieldCheck size={14}/> },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${s.color}18`, color: s.color }}>
                      {s.icon}
                    </div>
                    <div>
                      <p className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subscribers section */}
              <SubscribersSection teamName={team.name} canRev={canRev} />

              {/* Members table */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between px-5 py-4 border-b"
                  style={{ borderColor: "var(--border)" }}>
                  <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                    أعضاء الفريق
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${typeMeta.color}15`, color: typeMeta.color }}>
                    {members.length} موظف
                  </span>
                </div>

                {membersLoading ? (
                  <TableSkeleton rows={4} cols={6}/>
                ) : members.length === 0 ? (
                  <div className="py-12">
                    <EmptyState
                      icon={<User size={40}/>}
                      title="لا يوجد أعضاء بعد"
                      description="يمكنك إضافة موظفين من صفحة إدارة الموظفين"
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                          {["الموظف", "الدور", "الحالة", "الهاتف", "الصلاحيات", "تاريخ الإنشاء", ...(canEdit ? [""] : [])].map((h) => (
                            <th key={h} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider"
                              style={{ color: "var(--text-muted)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((emp) => (
                          <MemberRow
                            key={emp.uid}
                            emp={emp}
                            canEdit={canEdit}
                            isOwner={isOwner}
                            onRemove={setRemoving}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm remove dialog */}
      <AnimatePresence>
        {removing && (
          <div className="modal-overlay" onClick={() => setRemoving(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="modal-panel max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>إزالة من الفريق</h3>
              <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
                هل تريد إزالة <strong>{removing.name}</strong> من هذا الفريق؟
                سيبقى الحساب موجوداً لكن بدون فريق.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={assignTeamMut.isPending}
                  onClick={() => handleRemoveMember(removing)}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
                  style={{ background: "#f43f5e" }}
                >
                  {assignTeamMut.isPending ? "جاري..." : "إزالة"}
                </button>
                <button
                  onClick={() => setRemoving(null)}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
