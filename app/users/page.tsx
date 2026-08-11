"use client";

import { useEffect, useState, useMemo, useRef, Fragment } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { auth } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { permissionService } from "@/services";
import {
  ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  canManageRole,
  canAssignRole,
  getDefaultGranularPermissions,
} from "@/lib/permissions";
import { canReadUserDirectory } from "@/lib/permissionGuards";
import { PERMISSION_LABELS } from "@/types";
import { formatDateTime } from "@/lib/utils";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import type { UserProfile, Role, AccountStatus, GranularPermissions } from "@/types";
import {
   Search, Shield, ChevronDown, ChevronUp,
  RotateCcw, Save, X, AlertTriangle, 
  UserCheck, UserX, Clock} from "lucide-react";
import { toast } from "@/lib/toast";

function UserAvatar({ name, role }: { name: string; role: Role }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg =
    role === "owner" ? "#5B5FEF"
    : role === "admin" ? "#5B5FEF"
    : "#9CA3AF";
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
      style={{ background: bg, boxShadow: "0 1px 2px rgba(16,20,26,.08), inset 0 1px 0 rgba(255,255,255,.18)" }}
    >
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`role-${role}`}>{ROLE_LABELS[role]}</span>
  );
}

function StatusBadge({ status }: { status: AccountStatus | undefined }) {
  const s = status ?? "active";
  // Widened deliberately: Firestore holds statuses AccountStatus does not model
  // (soft-deleted rows carry "deleted"), and TypeScript would otherwise call the
  // check below dead code.
  const raw = s as string;
  const label = ACCOUNT_STATUS_LABELS[s];
  // Soft-deleted accounts carry status "deleted", which is not in AccountStatus:
  // the label came back undefined and the class matched no rule, so the cell
  // printed a bare unstyled "deleted" in English.
  if (!label) {
    return (
      <span
        style={{
          background: "var(--surface-muted)", color: "var(--text-muted)",
          border: "1px solid var(--border-soft)", borderRadius: 999,
          padding: "4px 12px", fontSize: 12, fontWeight: 600,
        }}
      >
        {raw === "deleted" ? "محذوف" : raw}
      </span>
    );
  }
  return <span className={`status-user-${s}`}>{label}</span>;
}

// ─── Permissions editor ──────────────────────────────────────────────────────

function PermissionsEditor({
  targetUser,
  actor,
  onClose,
}: {
  targetUser: UserProfile;
  actor: UserProfile;
  onClose: () => void;
}) {
  const isOwner = actor.role === "owner";
  const defaultGP = getDefaultGranularPermissions(targetUser.role);
  const [gp, setGp] = useState<GranularPermissions>(
    targetUser.granularPermissions ?? defaultGP
  );
  const [saving, setSaving] = useState(false);

  function toggle(category: keyof GranularPermissions, action: string) {
    if (!isOwner) return;
    setGp((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] as Record<string, boolean>),
        [action]: !(prev[category] as Record<string, boolean>)[action],
      },
    }));
  }

  async function handleSave() {
    if (!isOwner) return;
    setSaving(true);
    try {
      await permissionService.setGranularPermissions(actor, targetUser.uid, gp);
      toast.success("تم حفظ الصلاحيات");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const defaults = getDefaultGranularPermissions(targetUser.role);
    setGp(defaults);
  }

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50/40 p-4 mt-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-700">
            الصلاحيات التفصيلية — {targetUser.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
              >
                <RotateCcw size={12} /> إعادة تعيين
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
              >
                <Save size={12} />
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(PERMISSION_LABELS) as Array<keyof GranularPermissions>).map((category) => {
          const meta = PERMISSION_LABELS[category];
          const catGp = gp[category] as Record<string, boolean>;
          return (
            <div key={category} className="bg-white rounded-lg p-3 border border-slate-100">
              <p className="text-xs font-bold text-slate-600 mb-2">{meta.label}</p>
              <div className="space-y-1.5">
                {Object.entries(meta.actions).map(([action, label]) => (
                  <label
                    key={action}
                    className={`flex items-center gap-2 ${isOwner ? "cursor-pointer" : "cursor-default opacity-70"}`}
                  >
                    <input
                      type="checkbox"
                      checked={catGp[action] ?? false}
                      onChange={() => toggle(category, action)}
                      disabled={!isOwner}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                    <span className="text-xs text-slate-600">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!isOwner && (
        <p className="text-xs text-slate-400 mt-3 text-center">
          عرض فقط — إدارة الصلاحيات متاحة للمالك
        </p>
      )}
    </div>
  );
}

// ─── Confirmation modal ──────────────────────────────────────────────────────

interface ConfirmAction {
  uid: string;
  targetName: string;
  label: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}

function ConfirmModal({ action, onCancel }: { action: ConfirmAction; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      await action.onConfirm();
      onCancel();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.danger ? "bg-red-100" : "bg-amber-100"}`}>
            <AlertTriangle size={18} className={action.danger ? "text-red-600" : "text-amber-600"} />
          </div>
          <div>
            <p className="font-bold text-slate-800">تأكيد الإجراء</p>
            <p className="text-xs text-slate-500">{action.targetName}</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mb-6">{action.label}</p>
        <div className="flex gap-3">
          <button
            onClick={go}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition disabled:opacity-60 ${
              action.danger ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {loading ? "جاري..." : "تأكيد"}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user, can } = useAuthStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "">("");
  const [expandedPerms, setExpandedPerms] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  // Inline name edits
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [savingName, setSavingName] = useState<string | null>(null);

  const isOwner = user?.role === "owner";

  // Reading and mutating are two different permissions, and each mirrors a
  // different authority:
  //
  //  • canView   → firestore.rules `match /users` allows reads for self or
  //                staff, so any admin may browse the directory.
  //  • canManage → every mutation goes through /api/user-operations, which
  //                gates on hasServerPermission(user, "users", "manage").
  //                That function subjects admins to their granular permissions
  //                (only the owner is unconditional), and the admin default has
  //                users.manage = false.
  //
  // They used to be one flag with a `|| role === "admin"` escape hatch, which
  // showed every admin a set of controls the API then answered with 403.
  const canView   = canReadUserDirectory(user);
  const canManage = canView && can("canManageUsers");

  // Close status dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!openStatusMenu) return;
    function handleClick(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setOpenStatusMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openStatusMenu]);

  useEffect(() => {
    // Reading the directory needs staff level only — the same condition
    // firestore.rules applies to /users reads.
    if (!canView) { setLoading(false); return; }
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const data = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        .sort((a, b) => {
          const roleOrder: Record<Role, number> = { owner: 0, admin: 1, employee: 2 };
          return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3) ||
            (a.name || "").localeCompare(b.name || "", "ar");
        });
      setUsers(data);
      // Init name edits
      const edits: Record<string, string> = {};
      data.forEach((u) => { edits[u.uid] = u.name || ""; });
      setNameEdits((prev) => ({ ...edits, ...Object.fromEntries(Object.entries(prev).filter(([k]) => edits[k] !== undefined)) }));
      setLoading(false);
    });
    return () => unsub();
  }, [canView]);

  // `/users` documents can outlive the Auth account they describe — deleting a
  // user in the Firebase console does not touch Firestore. Those leftovers were
  // rendered as ordinary people, which is how the directory came to show two
  // "حنان", two "ميدو", and a third owner who cannot sign in.
  //
  // Which ones are stale is not answerable from the document. No field is a
  // reliable proxy: one live owner's profile has no `email`, another has no
  // `createdAt`, and a first guess at filtering on `email` hid a real owner.
  // The server enumerates Auth and returns the uids that actually exist.
  //
  // `null` means the check could not run (Admin credentials absent, request
  // failed). In that case nothing is hidden — showing a stale row is a much
  // smaller problem than hiding a real administrator.
  const [authUids, setAuthUids] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/users/auth-uids", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json();
        if (!cancelled && Array.isArray(body?.uids)) setAuthUids(new Set(body.uids));
      } catch {
        // Fail open — leave authUids null so no row is hidden.
      }
    })();
    return () => { cancelled = true; };
  }, [canView]);

  const [realUsers, ghostCount] = useMemo(() => {
    if (!authUids) return [users, 0];
    const real = users.filter((u) => authUids.has(u.uid));
    return [real, users.length - real.length];
  }, [users, authUids]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return realUsers.filter(
      (u) =>
        (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)) &&
        (!roleFilter || u.role === roleFilter) &&
        (!statusFilter || (u.status ?? (u.active ? "active" : "disabled")) === statusFilter)
    );
  }, [realUsers, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:     realUsers.length,
    owners:    realUsers.filter((u) => u.role === "owner").length,
    admins:    realUsers.filter((u) => u.role === "admin").length,
    employees: realUsers.filter((u) => u.role === "employee").length,
    active:    realUsers.filter((u) => (u.status ?? (u.active ? "active" : "disabled")) === "active").length,
  }), [realUsers]);

  async function handleRoleChange(target: UserProfile, newRole: Role) {
    if (!user) return;
    setConfirmAction({
      uid: target.uid,
      targetName: target.name,
      label: `تغيير دور "${target.name}" من ${ROLE_LABELS[target.role]} إلى ${ROLE_LABELS[newRole]}؟ سيتم إعادة تعيين الصلاحيات تلقائياً.`,
      danger: newRole === "owner",
      onConfirm: async () => {
        await permissionService.setRole(user, target.uid, target.role, newRole);
        toast.success(`تم تغيير دور ${target.name} إلى ${ROLE_LABELS[newRole]}`);
      },
    });
  }

  async function handleStatusChange(target: UserProfile, newStatus: AccountStatus) {
    if (!user) return;
    const labels: Record<AccountStatus, string> = {
      active:    "تفعيل",
      suspended: "تعليق",
      disabled:  "تعطيل",
      pending:   "وضع في قائمة الانتظار",
    };
    setConfirmAction({
      uid: target.uid,
      targetName: target.name,
      label: `${labels[newStatus]} حساب "${target.name}"؟`,
      danger: newStatus === "disabled",
      onConfirm: async () => {
        await permissionService.setStatus(user, target.uid, target.role, newStatus);
        toast.success(`تم ${labels[newStatus]} حساب ${target.name}`);
      },
    });
  }

  async function handleSaveName(target: UserProfile) {
    if (!user) return;
    const newName = nameEdits[target.uid]?.trim();
    if (!newName || newName === target.name) return;
    setSavingName(target.uid);
    try {
      await permissionService.updateProfile(user, target.uid, { name: newName });
      toast.success("تم حفظ الاسم");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSavingName(null);
    }
  }

  if (!canView) {
    return (
      <ProtectedLayout>
        <div className="p-5 md:p-7 max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">إدارة المستخدمين متاحة للمالك والمدير فقط</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="p-5 md:p-7 max-w-6xl mx-auto">

        {/* Header */}
        <PageHeader
          title="المستخدمون"
          subtitle={`${stats.total} مستخدم · ${stats.active} نشط`}
        />

        {/* Stats — one strip rather than five equal cards. These are context for
            the table below, not the subject of the page, and giving a permanent
            "0 مديرون" the same weight as the table made the page read as empty. */}
        <div
          className="mb-5 flex divide-x divide-x-reverse overflow-hidden"
          style={{
            background: "var(--surface)", border: "1px solid var(--border-soft)",
            borderRadius: 14, boxShadow: "var(--shadow-card)",
            borderColor: "var(--border-soft)",
          }}
        >
          {[
            { label: "مالكون",  value: stats.owners,    color: "#5B5FEF" },
            { label: "مديرون",  value: stats.admins,    color: "var(--jk-blue)" },
            { label: "موظفون",  value: stats.employees, color: "var(--text-primary)" },
            { label: "نشطون",   value: stats.active,    color: "#22C55E" },
          ].map((s) => (
            <div key={s.label} className="flex-1 px-4 py-3 text-center" style={{ borderColor: "var(--border-soft)" }}>
              <p style={{ fontSize: 19, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters. Widths are explicit because globals.css sizes every bare
            `input` and `select` at width:100%/height:44px — the status filter
            was taking a whole row on its own. */}
        <div
          className="mb-4 p-3 flex flex-wrap gap-2.5 items-center"
          style={{
            background: "var(--surface)", border: "1px solid var(--border-soft)",
            borderRadius: 14, boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="بحث بالاسم أو الإيميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", height: 38, borderRadius: 10,
                padding: "0 34px 0 12px", fontSize: 13,
                border: "1px solid var(--border-soft)", background: "var(--surface-2)",
                color: "var(--text-primary)", fontFamily: "inherit",
              }}
            />
          </div>

          <div className="flex gap-1 rounded-[10px] p-1 shrink-0" style={{ background: "var(--surface-muted)" }}>
            {(["", "owner", "admin", "employee"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r as Role | "")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  roleFilter === r
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r ? ROLE_LABELS[r as Role] : "الكل"}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "")}
            style={{
              width: "auto", height: 38, borderRadius: 10, padding: "0 12px",
              fontSize: 13, border: "1px solid var(--border-soft)",
              background: "var(--surface)", color: "var(--text-primary)", flexShrink: 0,
            }}
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="suspended">معلق</option>
            <option value="disabled">معطل</option>
            <option value="pending">معلق التفعيل</option>
          </select>

          <span className="text-xs mr-auto shrink-0" style={{ color: "var(--text-muted)" }}>
            {filtered.length === realUsers.length
              ? `${realUsers.length} مستخدم`
              : `${filtered.length} من ${realUsers.length}`}
          </span>
        </div>

        {/* Users table */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">جاري التحميل...</div>
        ) : (
          <div
            className="overflow-hidden"
            style={{
              background: "var(--surface)", border: "1px solid var(--border-soft)",
              borderRadius: 16, boxShadow: "var(--shadow-card)",
            }}
          >
            {/* jk-stack-table restacks each row as a labelled card under 768px,
                so the five columns do not force a horizontal scroll on a phone.
                The rule lives in globals.css; the data-label on each cell is
                what it reads for the field name. */}
            <table className="w-full text-sm jk-stack-table">
              <thead>
                <tr className="text-xs font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                  <th className="px-4 py-3 text-right">المستخدم</th>
                  <th className="px-4 py-3 text-right">الدور</th>
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">آخر دخول</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center jk-stack-full" style={{ color: "var(--text-muted)" }}>
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
                {filtered.map((u) => {
                  const isSelf    = u.uid === user?.uid;
                  const isTarget  = u.role === "owner" && user?.role !== "owner";
                  // canManage is the gate the API enforces (users.manage);
                  // canManageRole is the hierarchy check on this specific row.
                  const canEdit   = canManage && !isSelf && !isTarget
                                    && canManageRole(user?.role ?? "employee", u.role);
                  const uStatus   = u.status ?? (u.active ? "active" : "disabled");
                  const nameVal   = nameEdits[u.uid] ?? u.name ?? "";
                  const nameChanged = nameVal !== (u.name ?? "");

                  return (
                    <Fragment key={u.uid}>
                      <tr className="border-b border-slate-50 hover:bg-slate-50/40 transition">
                        {/* User info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={u.name || "?"} role={u.role} />
                            <div className="min-w-0">
                              {/* The name was an <input> for everyone, including
                                  viewers the API answers with 403. globals.css
                                  sizes every bare input at 44px with a border, so
                                  it also made each name look like a form field.
                                  It is text unless this viewer may actually edit. */}
                              {canEdit ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    value={nameVal}
                                    onChange={(e) =>
                                      setNameEdits((prev) => ({ ...prev, [u.uid]: e.target.value }))
                                    }
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveName(u)}
                                    aria-label={`اسم ${u.name}`}
                                    style={{
                                      width: 160, height: 28, padding: "0 6px", fontSize: 13.5,
                                      fontWeight: 600, borderRadius: 7, background: "transparent",
                                      border: "1px solid transparent", color: "var(--text-primary)",
                                      fontFamily: "inherit",
                                    }}
                                    className="hover:!border-slate-200 focus:!border-indigo-400 focus:!bg-white transition"
                                  />
                                  {nameChanged && (
                                    <button
                                      onClick={() => handleSaveName(u)}
                                      disabled={savingName === u.uid}
                                      className="jk-btn sm"
                                      style={{ height: 26, padding: "0 10px", fontSize: 11.5 }}
                                    >
                                      {savingName === u.uid ? "..." : "حفظ"}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                                  {u.name || "—"}
                                </p>
                              )}
                              <p className="text-xs truncate max-w-[190px]" dir="ltr" style={{ color: "var(--text-muted)" }}>
                                {u.email}
                              </p>
                            </div>
                            {isSelf && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                                style={{ background: "#EEF0FF", color: "#5B5FEF" }}
                              >
                                أنت
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Role — one control, not a badge beside a select
                            showing the same value. */}
                        <td className="px-4 py-3" data-label="الدور">
                          {canEdit && isOwner ? (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                              aria-label={`دور ${u.name}`}
                              className={`role-${u.role}`}
                              style={{
                                width: "auto", height: 28, padding: "0 10px",
                                fontSize: 12, fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              {(["owner", "admin", "employee"] as Role[])
                                .filter((r) => canAssignRole(user?.role ?? "employee", r))
                                .map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                            </select>
                          ) : (
                            <RoleBadge role={u.role} />
                          )}
                        </td>

                        {/* Status — the badge is the trigger, so there is no
                            separate chevron duplicating it. */}
                        <td className="px-4 py-3" data-label="الحالة">
                          <div className="flex items-center gap-2">
                            {!canEdit ? (
                              <StatusBadge status={u.status} />
                            ) : (
                              <div
                                className="relative"
                                ref={openStatusMenu === u.uid ? statusMenuRef : null}
                              >
                                <button
                                  onClick={() =>
                                    setOpenStatusMenu((prev) => (prev === u.uid ? null : u.uid))
                                  }
                                  aria-label={`تغيير حالة ${u.name}`}
                                  className="flex items-center gap-1 rounded-full transition hover:opacity-80"
                                >
                                  <StatusBadge status={u.status} />
                                  <ChevronDown size={13} style={{ color: "var(--text-muted)" }} />
                                </button>

                                {openStatusMenu === u.uid && (
                                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 min-w-40">
                                    {(["active", "suspended", "disabled"] as AccountStatus[])
                                      .filter((s) => s !== uStatus)
                                      .map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => {
                                            setOpenStatusMenu(null);
                                            handleStatusChange(u, s);
                                          }}
                                          className="w-full text-right px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                                        >
                                          {s === "active"    && <UserCheck size={12} className="text-emerald-500" />}
                                          {s === "suspended" && <Clock      size={12} className="text-amber-500" />}
                                          {s === "disabled"  && <UserX      size={12} className="text-red-500" />}
                                          {ACCOUNT_STATUS_LABELS[s]}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Last login */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap" data-label="آخر دخول" style={{ color: "var(--text-muted)" }}>
                          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "لم يسجّل دخولاً"}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-left">
                          <button
                            onClick={() =>
                              setExpandedPerms((p) => (p === u.uid ? null : u.uid))
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                              expandedPerms === u.uid
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            }`}
                            title="عرض / تعديل الصلاحيات"
                          >
                            <Shield size={13} />
                            <span>الصلاحيات</span>
                            {expandedPerms === u.uid ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                      </tr>

                      {/* Permissions panel */}
                      {expandedPerms === u.uid && (
                        <tr>
                          <td colSpan={5} className="px-4 pb-4 jk-stack-full">
                            <PermissionsEditor
                              targetUser={u}
                              actor={user!}
                              onClose={() => setExpandedPerms(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Hiding rows silently would be its own bug — say what was dropped. */}
        {!loading && ghostCount > 0 && (
          <p className="mt-3 text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <AlertTriangle size={13} style={{ color: "var(--jk-paused)" }} />
            {ghostCount === 1
              ? "سجل واحد مخفي: ملف تعريف بلا حساب دخول."
              : `${ghostCount} سجلات مخفية: ملفات تعريف بلا حساب دخول.`}
            <span style={{ opacity: 0.75 }}>شغّل <code>npm run audit:accounts</code> لعرضها.</span>
          </p>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </ProtectedLayout>
  );
}
