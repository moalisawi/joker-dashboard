"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

import ProtectedLayout  from "@/components/layout/ProtectedLayout";
import ConfirmDialog    from "@/components/ui/ConfirmDialog";
import EmptyState       from "@/components/ui/EmptyState";
import TableSkeleton    from "@/components/ui/TableSkeleton";
import RequirePermission from "@/components/auth/RequirePermission";

import { useAuthStore }    from "@/store/authStore";
import { useThemeStore }   from "@/store/themeStore";
import { useTeams, useCreateTeam, useDeactivateTeam, useActivateTeam, useDeleteTeam, useUpdateTeam } from "@/hooks/useTeams";
import { useEmployeeList } from "@/features/users/hooks";
import { createTeamSchema, type CreateTeamInput } from "@/features/users/schemas";
import { z }               from "zod";
import { canManageUsers }  from "@/lib/permissionGuards";
import { PERM }            from "@/constants/permissions";
import { auditService }    from "@/services/audit.service";
import type { Team }       from "@/types";
import {
  Users2, Plus, X, ShieldOff, ShieldCheck, Trash2, Users, Edit2, Briefcase,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META = {
  sales:     { label: "مبيعات", color: "#10b981", icon: <Briefcase size={14}/> },
  nutrition: { label: "تغذية",  color: "#8b5cf6", icon: <Users2 size={14}/> },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
      transition={{ duration:0.2 }}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-lg font-bold text-sm text-white flex items-center gap-2"
      style={{ background: ok ? "#10b981" : "#f43f5e" }}
    >
      {ok ? "✓" : "✕"} {msg}
    </motion.div>
  );
}

// ─── Create Team Modal ────────────────────────────────────────────────────────

function CreateTeamModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string, id: string) => void }) {
  const createMut = useCreateTeam();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: "", type: "sales" },
  });

  async function onSubmit(data: CreateTeamInput) {
    try {
      const id = await createMut.mutateAsync(data);
      onSuccess("تم إنشاء الفريق بنجاح", id);
      onClose();
    } catch (e) { alert(e instanceof Error ? e.message : "حدث خطأ"); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.97, y:8 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.97, y:8 }} transition={{ duration:0.18 }}
        className="modal-panel max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
          <h3 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>إنشاء فريق جديد</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>اسم الفريق *</label>
            <input {...register("name")} className="form-input" placeholder="مثال: فريق المبيعات أ"/>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>النوع *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["sales","nutrition"] as const).map((type) => {
                const meta = TYPE_META[type];
                return (
                  <label key={type}
                    className="flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all"
                    style={{ borderColor:"var(--border)" }}>
                    <input {...register("type")} type="radio" value={type} className="accent-indigo-500"/>
                    <span style={{ color:meta.color }}>{meta.icon}</span>
                    <span className="text-sm font-semibold" style={{ color:"var(--text-primary)" }}>{meta.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
              style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)" }}>
              {createMut.isPending ? "جاري..." : "إنشاء الفريق"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border text-sm font-semibold"
              style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Rename Team Modal ────────────────────────────────────────────────────────

const renameSchema = z.object({ name: z.string().min(2, "الاسم مطلوب").max(60) });
type RenameInput = z.infer<typeof renameSchema>;

function RenameTeamModal({ team, onClose, onSuccess }: {
  team: Team; onClose: () => void; onSuccess: (msg: string) => void;
}) {
  const updateMut = useUpdateTeam();
  const { register, handleSubmit, formState: { errors } } = useForm<RenameInput>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: team.name },
  });

  async function onSubmit(data: RenameInput) {
    try {
      await updateMut.mutateAsync({ id: team.id, data: { name: data.name } });
      onSuccess("تم تغيير اسم الفريق");
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
          <h3 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>تغيير اسم: {team.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>الاسم الجديد *</label>
            <input {...register("name")} className="form-input"/>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={updateMut.isPending}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
              style={{ background:"#6366f1" }}>
              {updateMut.isPending ? "جاري..." : "حفظ"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
              style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamCard({ team, memberCount, canEdit, isOwner, onRename, onDeactivate, onActivate, onDelete }: {
  team: Team; memberCount: number; canEdit: boolean; isOwner: boolean;
  onRename: () => void; onDeactivate: () => void; onActivate: () => void; onDelete: () => void;
}) {
  const meta = TYPE_META[team.type];
  return (
    <motion.div
      initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)", opacity: team.active ? 1 : 0.55 }}
    >
      <div className="h-1" style={{ background:`linear-gradient(90deg,${meta.color}cc,${meta.color}44)` }}/>
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background:`${meta.color}18`, border:`1px solid ${meta.color}28` }}>
            <span style={{ color:meta.color, transform:"scale(1.5)" }}>{meta.icon}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: team.active ? "#10b98118" : "#94a3b818", color: team.active ? "#10b981" : "#94a3b8" }}>
              {team.active ? "نشط" : "معطّل"}
            </span>
            {canEdit && (
              <>
                <button onClick={onRename} title="تغيير الاسم"
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ background:"#6366f112", color:"#6366f1" }}>
                  <Edit2 size={12}/>
                </button>
                {team.active ? (
                  <button onClick={onDeactivate} title="تعطيل الفريق"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background:"#f59e0b12", color:"#f59e0b" }}>
                    <ShieldOff size={12}/>
                  </button>
                ) : (
                  <button onClick={onActivate} title="إعادة تفعيل الفريق"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background:"#10b98112", color:"#10b981" }}>
                    <ShieldCheck size={12}/>
                  </button>
                )}
                {isOwner && (
                  <button onClick={onDelete} title="حذف الفريق"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background:"#f43f5e12", color:"#f43f5e" }}>
                    <Trash2 size={12}/>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <h3 className="font-black text-lg mb-1" style={{ color:"var(--text-primary)" }}>{team.name}</h3>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-4"
          style={{ background:`${meta.color}15`, color:meta.color }}>
          {meta.icon}{meta.label}
        </span>

        <div className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background:"var(--surface-2)", border:"1px solid var(--border)" }}>
          <Users size={14} style={{ color:"var(--text-muted)" }}/>
          <span className="text-sm font-bold tabular-nums" style={{ color:"var(--text-primary)" }}>{memberCount}</span>
          <span className="text-xs" style={{ color:"var(--text-muted)" }}>موظف</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminTeamsPage() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const { dark } = useThemeStore();

  const { loading } = useAuthStore();
  useEffect(() => {
    if (!loading && user && !canManageUsers(user)) router.replace("/");
  }, [user, loading, router]);

  const { data: teams = [],    isLoading } = useTeams();
  const { data: employees = [] }           = useEmployeeList();
  const deactivateMut                      = useDeactivateTeam();
  const activateMut                        = useActivateTeam();
  const deleteMut                          = useDeleteTeam();

  const [showCreate,     setShowCreate]    = useState(false);
  const [renameTeam,     setRenameTeam]    = useState<Team | null>(null);
  const [confirmTeam,    setConfirmTeam]   = useState<Team | null>(null);
  const [confirmActivate,setConfirmActivate] = useState<Team | null>(null);
  const [confirmDelete,  setConfirmDelete] = useState<Team | null>(null);
  const [toast, setToast]                  = useState<{ msg: string; ok: boolean } | null>(null);

  const canEdit  = canManageUsers(user);
  const isOwner  = user?.role === "owner";

  const memberCounts = useMemo(() => {
    const m: Record<string,number> = {};
    employees.forEach((e) => { if (e.teamId) m[e.teamId] = (m[e.teamId] ?? 0) + 1; });
    return m;
  }, [employees]);

  const stats = useMemo(() => ({
    total:     teams.length,
    active:    teams.filter((t) => t.active).length,
    sales:     teams.filter((t) => t.type === "sales").length,
    nutrition: teams.filter((t) => t.type === "nutrition").length,
  }), [teams]);

  function toast$(msg: string, ok = true) { setToast({ msg, ok }); }

  async function handleDeactivate(team: Team) {
    try {
      await deactivateMut.mutateAsync(team.id);
      if (user) auditService.track({ actor: user, action: "team_deactivated", entity: "team", entityId: team.id, entityName: team.name, metadata: { type: team.type }, tags: ["team", "deactivated"] }).catch(() => undefined);
      setConfirmTeam(null);
      toast$("تم تعطيل الفريق");
    } catch (e) {
      toast$(e instanceof Error ? e.message : "حدث خطأ", false);
      setConfirmTeam(null);
    }
  }

  async function handleActivate(team: Team) {
    try {
      await activateMut.mutateAsync(team.id);
      if (user) auditService.track({ actor: user, action: "team_activated", entity: "team", entityId: team.id, entityName: team.name, tags: ["team", "activated"] }).catch(() => undefined);
      setConfirmActivate(null);
      toast$("تم إعادة تفعيل الفريق");
    } catch (e) {
      toast$(e instanceof Error ? e.message : "حدث خطأ", false);
      setConfirmActivate(null);
    }
  }

  async function handleDelete(team: Team) {
    try {
      await deleteMut.mutateAsync(team.id);
      if (user) auditService.track({ actor: user, action: "team_deleted", entity: "team", entityId: team.id, entityName: team.name, tags: ["team", "deleted"] }).catch(() => undefined);
      setConfirmDelete(null);
      toast$("تم حذف الفريق");
    } catch (e) {
      toast$(e instanceof Error ? e.message : "حدث خطأ", false);
      setConfirmDelete(null);
    }
  }

  return (
    <ProtectedLayout>
      <AnimatePresence>
        {toast && <Toast key="t" msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)}/>}
      </AnimatePresence>

      <div className="min-h-full" style={{ background:"var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-9 w-9 flex items-center justify-center rounded-xl"
                  style={{ background:"#8b5cf618", border:"1px solid #8b5cf628" }}>
                  <Users2 size={16} style={{ color:"#8b5cf6" }}/>
                </div>
                <h1 className="text-xl font-black tracking-tight" style={{ color:"var(--text-primary)" }}>
                  إدارة الفرق
                </h1>
              </div>
              <p className="text-sm" style={{ color:"var(--text-secondary)" }}>
                {stats.total} فريق · {stats.active} نشط
              </p>
            </div>
            <RequirePermission permission={PERM.MANAGE_USERS}>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-all hover:opacity-90"
                style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)" }}>
                <Plus size={16}/> إنشاء فريق
              </button>
            </RequirePermission>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label:"إجمالي الفرق",  value:stats.total,     color:"#8b5cf6" },
              { label:"الفرق النشطة",  value:stats.active,    color:"#10b981" },
              { label:"فرق المبيعات",  value:stats.sales,     color:"#f59e0b" },
              { label:"فرق التغذية",   value:stats.nutrition, color:"#8b5cf6" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-4"
                style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
                <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color:"var(--text-muted)" }}>{s.label}</p>
                <p className="text-2xl font-black tabular-nums" style={{ color:s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Teams grid or skeleton */}
          {isLoading ? (
            <div className="rounded-2xl overflow-hidden"
              style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
              <TableSkeleton rows={3} cols={3}/>
            </div>
          ) : teams.length === 0 ? (
            <EmptyState
              icon={<Users2 size={48}/>}
              title="لا توجد فرق بعد"
              description="أنشئ أول فريق لتنظيم الموظفين"
              action={canEdit
                ? <button onClick={() => setShowCreate(true)}
                    className="px-4 py-2 rounded-xl text-white text-sm font-bold"
                    style={{ background:"#8b5cf6" }}>إنشاء فريق</button>
                : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teams.map((team) => (
                <TeamCard
                  key={team.id} team={team}
                  memberCount={memberCounts[team.id] ?? 0}
                  canEdit={canEdit}
                  isOwner={isOwner}
                  onRename={() => setRenameTeam(team)}
                  onDeactivate={() => setConfirmTeam(team)}
                  onActivate={() => setConfirmActivate(team)}
                  onDelete={() => setConfirmDelete(team)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateTeamModal key="create"
            onClose={() => setShowCreate(false)}
            onSuccess={(msg, id) => {
              toast$(msg);
              // Audit log for team creation
              if (user) {
                auditService.track({
                  actor: user, action: "team_created",
                  entity: "team", entityId: id,
                  tags: ["team", "created"],
                }).catch(() => undefined);
              }
            }}
          />
        )}
        {renameTeam && (
          <RenameTeamModal key="rename" team={renameTeam}
            onClose={() => setRenameTeam(null)}
            onSuccess={(msg) => {
              toast$(msg);
              if (user && renameTeam) {
                auditService.track({
                  actor: user, action: "team_updated",
                  entity: "team", entityId: renameTeam.id, entityName: renameTeam.name,
                  tags: ["team", "renamed"],
                }).catch(() => undefined);
              }
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(confirmTeam)}
        title="تعطيل الفريق"
        description={`سيُوقف الفريق "${confirmTeam?.name}" ولن يظهر في قوائم التعيين. يمكنك إعادة تفعيله لاحقاً.`}
        confirmLabel="تعطيل" destructive
        loading={deactivateMut.isPending}
        onClose={() => setConfirmTeam(null)}
        onConfirm={() => { if (confirmTeam) handleDeactivate(confirmTeam); }}
      />

      <ConfirmDialog
        open={Boolean(confirmActivate)}
        title="إعادة تفعيل الفريق"
        description={`سيُعاد تفعيل الفريق "${confirmActivate?.name}" وسيظهر مجدداً في قوائم التعيين.`}
        confirmLabel="تفعيل"
        loading={activateMut.isPending}
        onClose={() => setConfirmActivate(null)}
        onConfirm={() => { if (confirmActivate) handleActivate(confirmActivate); }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="حذف الفريق نهائياً"
        description={`سيُحذف الفريق "${confirmDelete?.name}" بشكل دائم ولن تتمكن من استعادته. الموظفون المرتبطون به لن يُحذفوا.`}
        confirmLabel="حذف نهائياً" destructive
        loading={deleteMut.isPending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
      />
    </ProtectedLayout>
  );
}
