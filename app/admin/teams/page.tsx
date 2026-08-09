"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

import ProtectedLayout  from "@/components/layout/ProtectedLayout";
import PageHeader       from "@/components/layout/PageHeader";
import ConfirmDialog    from "@/components/ui/ConfirmDialog";
import EmptyState       from "@/components/ui/EmptyState";
import TableSkeleton    from "@/components/ui/TableSkeleton";

import { useAuthStore }    from "@/store/authStore";
import { useTeams, useCreateTeam, useDeactivateTeam, useActivateTeam, useDeleteTeam, useUpdateTeam } from "@/hooks/useTeams";
import { useEmployeeList } from "@/features/users/hooks";
import { useSubscribers }  from "@/hooks/useSubscribers";
import { createTeamSchema, type CreateTeamInput } from "@/features/users/schemas";
import { z }               from "zod";
import { canManageTeams, canDeleteTeams } from "@/lib/permissionGuards";
import { auditService }    from "@/services/audit.service";
import type { Team }       from "@/types";
import {
  Users2, Plus, X, ShieldOff, ShieldCheck, Trash2, Users, Edit2, Briefcase, GripVertical,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META = {
  sales: {
    label:    "مبيعات",
    color:    "#5B5FEF",
    gradient: "linear-gradient(135deg, rgba(91,95,239,.12) 0%, rgba(91,95,239,.04) 60%, transparent 100%)",
    badge:    { bg: "rgba(91,95,239,.14)", border: "rgba(91,95,239,.32)" },
    icon:     <Briefcase size={15}/>,
  },
  nutrition: {
    label:    "تغذية",
    color:    "#F59E0B",
    gradient: "linear-gradient(135deg, rgba(245,158,11,.12) 0%, rgba(245,158,11,.04) 60%, transparent 100%)",
    badge:    { bg: "rgba(245,158,11,.14)", border: "rgba(245,158,11,.32)" },
    icon:     <Users2 size={15}/>,
  },
};

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
              style={{ background:"linear-gradient(135deg,#3B82F6,#5B5FEF)" }}>
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
              style={{ background:"#5B5FEF" }}>
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

function TeamCard({ team, memberCount, subscriberCount, canEdit, isOwner, onRename, onDeactivate, onActivate, onDelete, dragHandle }: {
  team: Team; memberCount: number; subscriberCount: number; canEdit: boolean; isOwner: boolean;
  onRename: () => void; onDeactivate: () => void; onActivate: () => void; onDelete: () => void;
  dragHandle?: React.ReactNode;
}) {
  const meta = TYPE_META[team.type];
  return (
    <motion.div
      initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `var(--surface)`,
        backgroundImage: team.active ? meta.gradient : "none",
        border: `1px solid ${meta.color}30`,
        boxShadow: `var(--shadow-card), 0 0 0 0 ${meta.color}`,
        opacity: team.active ? 1 : 0.55,
        transition: "box-shadow .25s ease, transform .25s ease",
      }}
      whileHover={{ y: -2, boxShadow: `0 1px 2px rgba(16,20,26,.04), 0 14px 32px -10px ${meta.color}30` } as never}
    >
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {dragHandle}
            <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `${meta.color}20`,
                border: `1.5px solid ${meta.color}40`,
                boxShadow: `0 4px 12px ${meta.color}25`,
                color: meta.color,
              }}>
              <span style={{ transform:"scale(1.4)" }}>{meta.icon}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: team.active ? "#5B5FEF18" : "#9ca3af18", color: team.active ? "#5B5FEF" : "#9ca3af" }}>
              {team.active ? "نشط" : "معطّل"}
            </span>
            {canEdit && (
              <>
                <button onClick={onRename} title="تغيير الاسم"
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ background:"#5B5FEF12", color:"#5B5FEF" }}>
                  <Edit2 size={12}/>
                </button>
                {team.active ? (
                  <button onClick={onDeactivate} title="تعطيل الفريق"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background:"#F59E0B12", color:"#F59E0B" }}>
                    <ShieldOff size={12}/>
                  </button>
                ) : (
                  <button onClick={onActivate} title="إعادة تفعيل الفريق"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background:"#5B5FEF12", color:"#5B5FEF" }}>
                    <ShieldCheck size={12}/>
                  </button>
                )}
                {isOwner && (
                  <button onClick={onDelete} title="حذف الفريق"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background:"#EF444412", color:"#EF4444" }}>
                    <Trash2 size={12}/>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <h3 className="font-black text-lg mb-1.5" style={{ color:"var(--text-primary)", letterSpacing:"-0.02em" }}>{team.name}</h3>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{
            background: meta.badge.bg,
            color: meta.color,
            border: `1px solid ${meta.badge.border}`,
          }}>
          {meta.icon}{meta.label}
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background:"var(--surface-2)", border:"1px solid var(--border)" }}>
            <Users size={13} style={{ color:"var(--text-muted)" }}/>
            <span className="text-sm font-bold tabular-nums" style={{ color:"var(--text-primary)" }}>{memberCount}</span>
            <span className="text-xs" style={{ color:"var(--text-muted)" }}>موظف</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background:"var(--surface-2)", border:"1px solid var(--border)" }}>
            <Users2 size={13} style={{ color: meta.color }}/>
            <span className="text-sm font-bold tabular-nums" style={{ color:"var(--text-primary)" }}>{subscriberCount}</span>
            <span className="text-xs" style={{ color:"var(--text-muted)" }}>مشترك</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sortable Team Card ───────────────────────────────────────────────────────

function SortableTeamCard(props: {
  team: Team; memberCount: number; subscriberCount: number; canEdit: boolean; isOwner: boolean;
  onRename: () => void; onDeactivate: () => void; onActivate: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.team.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : undefined,
  };
  const handle = (
    <button
      {...attributes}
      {...listeners}
      className="p-1.5 rounded-lg cursor-grab active:cursor-grabbing touch-none"
      style={{ color:"var(--text-muted)", background:"var(--surface-2)" }}
      title="اسحب لإعادة الترتيب"
    >
      <GripVertical size={14}/>
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      <TeamCard {...props} dragHandle={handle}/>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminTeamsPage() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const { loading } = useAuthStore();
  useEffect(() => {
    // Gate on the same condition firestore.rules uses for team writes
    // (`allow create, update: if isOwner()`). Gating on canManageUsers let an
    // owner delegate users.manage and hand someone a page whose every save
    // would be rejected.
    if (!loading && user && !canManageTeams(user)) router.replace("/");
  }, [user, loading, router]);

  const { data: teams = [],    isLoading } = useTeams();
  const { data: employees = [] }           = useEmployeeList();
  const { subscribers }                    = useSubscribers();
  const deactivateMut                      = useDeactivateTeam();
  const activateMut                        = useActivateTeam();
  const deleteMut                          = useDeleteTeam();

  const [showCreate,     setShowCreate]    = useState(false);
  const [renameTeam,     setRenameTeam]    = useState<Team | null>(null);
  const [confirmTeam,    setConfirmTeam]   = useState<Team | null>(null);
  const [confirmActivate,setConfirmActivate] = useState<Team | null>(null);
  const [confirmDelete,  setConfirmDelete] = useState<Team | null>(null);
  const [teamOrder,      setTeamOrder]     = useState<string[]>([]);
  const canEdit  = canManageTeams(user);
  const isOwner  = canDeleteTeams(user);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedTeams = useMemo(() => {
    if (teamOrder.length === 0) return teams;
    const map = Object.fromEntries(teams.map((t) => [t.id, t]));
    const ordered = teamOrder.map((id) => map[id]).filter(Boolean) as Team[];
    const newOnes = teams.filter((t) => !teamOrder.includes(t.id));
    return [...ordered, ...newOnes];
  }, [teams, teamOrder]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedTeams.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    setTeamOrder(arrayMove(ids, oldIndex, newIndex));
  }

  const memberCounts = useMemo(() => {
    const m: Record<string,number> = {};
    employees.forEach((e) => { if (e.teamId) m[e.teamId] = (m[e.teamId] ?? 0) + 1; });
    return m;
  }, [employees]);

  const subscriberCounts = useMemo(() => {
    const m: Record<string,number> = {};
    subscribers.forEach((s) => { if (s.team) m[s.team] = (m[s.team] ?? 0) + 1; });
    return m;
  }, [subscribers]);

  const stats = useMemo(() => ({
    total:     teams.length,
    active:    teams.filter((t) => t.active).length,
    sales:     teams.filter((t) => t.type === "sales").length,
    nutrition: teams.filter((t) => t.type === "nutrition").length,
  }), [teams]);

  async function handleDeactivate(team: Team) {
    try {
      await deactivateMut.mutateAsync(team.id);
      if (user) auditService.track({ actor: user, action: "team_deactivated", entity: "team", entityId: team.id, entityName: team.name, metadata: { type: team.type }, tags: ["team", "deactivated"] }).catch(() => undefined);
      setConfirmTeam(null);
      toast.success("تم تعطيل الفريق");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
      setConfirmTeam(null);
    }
  }

  async function handleActivate(team: Team) {
    try {
      await activateMut.mutateAsync(team.id);
      if (user) auditService.track({ actor: user, action: "team_activated", entity: "team", entityId: team.id, entityName: team.name, tags: ["team", "activated"] }).catch(() => undefined);
      setConfirmActivate(null);
      toast.success("تم إعادة تفعيل الفريق");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
      setConfirmActivate(null);
    }
  }

  async function handleDelete(team: Team) {
    try {
      await deleteMut.mutateAsync(team.id);
      if (user) auditService.track({ actor: user, action: "team_deleted", entity: "team", entityId: team.id, entityName: team.name, tags: ["team", "deleted"] }).catch(() => undefined);
      setConfirmDelete(null);
      toast.success("تم حذف الفريق");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
      setConfirmDelete(null);
    }
  }

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background:"var(--page-bg)" }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 space-y-6">

          {/* Header */}
          <PageHeader
            title="الفرق"
            subtitle={`${stats.total} فريق · ${stats.active} نشط`}
            actions={
              canEdit && (
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-all hover:opacity-90"
                  style={{ background:"linear-gradient(135deg,#3B82F6,#5B5FEF)" }}>
                  <Plus size={16}/> إنشاء فريق
                </button>
              )
            }
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label:"إجمالي الفرق",  value:stats.total,     color:"#6B7280" },
              { label:"الفرق النشطة",  value:stats.active,    color:"#5B5FEF" },
              { label:"فرق المبيعات",  value:stats.sales,     color: TYPE_META.sales.color     },
              { label:"فرق التغذية",   value:stats.nutrition, color: TYPE_META.nutrition.color },
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
                    style={{ background:"#3B82F6" }}>إنشاء فريق</button>
                : undefined}
            />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedTeams.map((t) => t.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {orderedTeams.map((team) => (
                    <SortableTeamCard
                      key={team.id} team={team}
                      memberCount={memberCounts[team.id] ?? 0}
                      subscriberCount={subscriberCounts[team.name] ?? 0}
                      canEdit={canEdit}
                      isOwner={isOwner}
                      onRename={() => setRenameTeam(team)}
                      onDeactivate={() => setConfirmTeam(team)}
                      onActivate={() => setConfirmActivate(team)}
                      onDelete={() => setConfirmDelete(team)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateTeamModal key="create"
            onClose={() => setShowCreate(false)}
            onSuccess={(msg, id) => {
              toast.success(msg);
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
              toast.success(msg);
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
