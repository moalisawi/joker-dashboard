"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useRef, Fragment } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import { permissionService } from "@/services";
import {
  ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  canManageRole,
  canAssignRole,
  getDefaultGranularPermissions,
} from "@/lib/permissions";
import { PERMISSION_LABELS } from "@/types";
import { formatDateTime } from "@/lib/utils";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import type { UserProfile, Role, AccountStatus, GranularPermissions } from "@/types";
import {
  Users, Search, Shield, ChevronDown, ChevronUp,
  RotateCcw, Save, X, AlertTriangle, Crown,
  UserCheck, UserX, Clock,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toast(msg: string, isError = false) {
  const el = document.createElement("div");
  el.className = isError ? "toast-error" : "toast-success";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function UserAvatar({ name, role }: { name: string; role: Role }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg =
    role === "owner"
      ? "bg-amber-400 text-amber-900"
      : role === "admin"
      ? "bg-blue-500 text-white"
      : "bg-slate-400 text-white";
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${bg}`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cls = `role-${role}`;
  const icon = role === "owner" ? "👑" : role === "admin" ? "🛡️" : "👤";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      {icon} {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: AccountStatus | undefined }) {
  const s = status ?? "active";
  const cls = `status-user-${s}`;
  const icon =
    s === "active"    ? "●" :
    s === "suspended" ? "⏸" :
    s === "disabled"  ? "✕" : "○";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      {icon} {ACCOUNT_STATUS_LABELS[s] ?? s}
    </span>
  );
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
      toast("تم حفظ الصلاحيات");
      onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "فشل الحفظ", true);
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
      toast(e instanceof Error ? e.message : "فشل التنفيذ", true);
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
  const canManage = can("canManageUsers") || user?.role === "admin";

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
    if (!canManage) { setLoading(false); return; }
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
  }, [canManage]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)) &&
        (!roleFilter || u.role === roleFilter) &&
        (!statusFilter || (u.status ?? (u.active ? "active" : "disabled")) === statusFilter)
    );
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:     users.length,
    owners:    users.filter((u) => u.role === "owner").length,
    admins:    users.filter((u) => u.role === "admin").length,
    employees: users.filter((u) => u.role === "employee").length,
    active:    users.filter((u) => (u.status ?? (u.active ? "active" : "disabled")) === "active").length,
  }), [users]);

  async function handleRoleChange(target: UserProfile, newRole: Role) {
    if (!user) return;
    setConfirmAction({
      uid: target.uid,
      targetName: target.name,
      label: `تغيير دور "${target.name}" من ${ROLE_LABELS[target.role]} إلى ${ROLE_LABELS[newRole]}؟ سيتم إعادة تعيين الصلاحيات تلقائياً.`,
      danger: newRole === "owner",
      onConfirm: async () => {
        await permissionService.setRole(user, target.uid, target.role, newRole);
        toast(`تم تغيير دور ${target.name} إلى ${ROLE_LABELS[newRole]}`);
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
        toast(`تم ${labels[newStatus]} حساب ${target.name}`);
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
      toast("تم حفظ الاسم");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "فشل الحفظ", true);
    } finally {
      setSavingName(null);
    }
  }

  if (!canManage) {
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">إدارة المستخدمين</h1>
              <p className="text-slate-500 text-sm">{stats.total} مستخدم · {stats.active} نشط</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "الكل",     value: stats.total,     icon: <Users size={16} />,      cls: "text-slate-700" },
            { label: "مالكون",   value: stats.owners,    icon: <Crown size={16} />,      cls: "text-amber-600" },
            { label: "مديرون",   value: stats.admins,    icon: <Shield size={16} />,     cls: "text-blue-600"  },
            { label: "موظفون",   value: stats.employees, icon: <UserCheck size={16} />,  cls: "text-slate-500" },
            { label: "نشطون",    value: stats.active,    icon: <UserCheck size={16} />,  cls: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
              <div className={`flex items-center justify-center gap-1 ${s.cls} mb-1`}>{s.icon}</div>
              <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الإيميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Role filter tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
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
            className="form-input w-auto"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="suspended">معلق</option>
            <option value="disabled">معطل</option>
            <option value="pending">معلق التفعيل</option>
          </select>

          <span className="text-xs text-slate-400">{filtered.length} من {users.length}</span>
        </div>

        {/* Users table */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
                  <th className="px-4 py-3 text-right">المستخدم</th>
                  <th className="px-4 py-3 text-right">الدور</th>
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">آخر دخول</th>
                  <th className="px-4 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
                {filtered.map((u) => {
                  const isSelf    = u.uid === user?.uid;
                  const isTarget  = u.role === "owner" && user?.role !== "owner";
                  const canEdit   = !isSelf && !isTarget && canManageRole(user?.role ?? "employee", u.role);
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
                              <div className="flex items-center gap-2">
                                <input
                                  value={nameVal}
                                  onChange={(e) =>
                                    setNameEdits((prev) => ({ ...prev, [u.uid]: e.target.value }))
                                  }
                                  onKeyDown={(e) => e.key === "Enter" && handleSaveName(u)}
                                  className="font-semibold text-slate-800 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none transition w-40"
                                />
                                {nameChanged && (
                                  <button
                                    onClick={() => handleSaveName(u)}
                                    disabled={savingName === u.uid}
                                    className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
                                  >
                                    {savingName === u.uid ? "..." : "حفظ"}
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate max-w-48" dir="ltr">
                                {u.email}
                              </p>
                              {isSelf && (
                                <span className="text-[10px] text-blue-500 font-semibold">أنت</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <RoleBadge role={u.role} />
                            {canEdit && isOwner && (
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                                className="text-xs border border-slate-200 rounded-lg px-1.5 py-0.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              >
                                {(["owner", "admin", "employee"] as Role[])
                                  .filter((r) => canAssignRole(user?.role ?? "employee", r))
                                  .map((r) => (
                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                  ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={u.status} />
                            {canEdit && (
                              <div
                                className="relative"
                                ref={openStatusMenu === u.uid ? statusMenuRef : null}
                              >
                                <button
                                  onClick={() =>
                                    setOpenStatusMenu((prev) => (prev === u.uid ? null : u.uid))
                                  }
                                  className={`p-1 rounded-lg transition ${
                                    openStatusMenu === u.uid
                                      ? "bg-slate-200 text-slate-700"
                                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <ChevronDown size={14} />
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
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() =>
                                setExpandedPerms((p) => (p === u.uid ? null : u.uid))
                              }
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                expandedPerms === u.uid
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                              title="عرض / تعديل الصلاحيات"
                            >
                              <Shield size={12} />
                              {expandedPerms === u.uid ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Permissions panel */}
                      {expandedPerms === u.uid && (
                        <tr>
                          <td colSpan={5} className="px-4 pb-4">
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
