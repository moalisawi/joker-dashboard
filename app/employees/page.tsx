"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { useEmployees } from "@/hooks/useEmployees";
import { useSubscribers } from "@/hooks/useSubscribers";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { callUserOperation } from "@/lib/clientUserOperations";
import type { UserProfile, EmployeeRole, EmployeeDepartment } from "@/types";
import { formatNumber } from "@/lib/utils";
import {
  Users, Plus, Edit, Trash2, CheckCircle, XCircle,
  X, Save, Briefcase, TrendingUp, UserCheck, Trophy, Mail, Eye, EyeOff,
} from "lucide-react";
import { usersFeatureService } from "@/features/users/services/users.service";

// ── Theme ─────────────────────────────────────────────────────────────────────
const LT = { bg:"var(--page-bg)", card:"var(--surface)", card2:"var(--surface-2)", border:"rgba(15,23,42,0.08)", t1:"var(--text-primary)", t2:"#64748b", t3:"#94a3b8", shadow:"0 1px 3px rgba(15,23,42,0.06),0 4px 12px rgba(15,23,42,0.05)" };
const DT = { bg:"#070c18", card:"rgba(255,255,255,0.04)", card2:"rgba(255,255,255,0.025)", border:"rgba(255,255,255,0.08)", t1:"#f1f5f9", t2:"#64748b", t3:"#334155", shadow:"none" };

const ACC = { indigo:"#6366f1", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8", violet:"#8b5cf6" };

const ROLE_META: Record<EmployeeRole, { label:string; color:string; icon:string }> = {
  owner:    { label:"مالك",     color:ACC.amber,   icon:"👑" },
  admin:    { label:"مدير",     color:ACC.indigo,  icon:"🛡️" },
  sales:    { label:"مبيعات",   color:ACC.emerald, icon:"💼" },
  followup: { label:"متابعة",   color:ACC.sky,     icon:"📞" },
};
const DEPARTMENTS: EmployeeDepartment[] = ["مبيعات","متابعة","إدارة","أخرى"];

// ── Animations ────────────────────────────────────────────────────────────────
const fadeUp  = { hidden:{opacity:0,y:14}, show:{opacity:1,y:0} };
const stagger = { show:{transition:{staggerChildren:0.06}} };
const tran    = { duration:0.35, ease:"easeOut" } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name:string) {
  return name.split(" ").map((w)=>w[0]).slice(0,2).join("").toUpperCase() || "؟";
}
function avatarGradient(role:EmployeeRole) {
  const m = ROLE_META[role];
  return `linear-gradient(135deg, ${m.color}cc, ${m.color}88)`;
}

// ── Form shape (for add & edit) ───────────────────────────────────────────────
interface EmpForm {
  fullName: string;
  email: string;
  password: string;
  employeeRole: EmployeeRole;
  department: EmployeeDepartment;
  notes: string;
}
const EMPTY: EmpForm = { fullName:"", email:"", password:"", employeeRole:"sales", department:"مبيعات", notes:"" };

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, t }:{
  icon:React.ReactNode; label:string; value:string|number; accent:string; t:typeof LT;
}) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl"
        style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
        <span style={{ color:accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color:t.t3 }}>{label}</p>
        <p className="text-xl font-black tabular-nums" style={{ color:t.t1 }}>{value}</p>
      </div>
    </motion.div>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmpCard({ emp, subCount, revenue, canEdit, onEdit, onToggle, onDemote, t }:{
  emp:UserProfile; subCount:number; revenue:number; canEdit:boolean;
  onEdit:()=>void; onToggle:()=>void; onDemote:()=>void; t:typeof LT;
}) {
  const role = emp.employeeRole ?? "sales";
  const meta = ROLE_META[role] ?? ROLE_META.sales;
  const canRev = useAuthStore().can("canViewRevenue");

  return (
    <motion.div variants={fadeUp} transition={tran}
      whileHover={{ y:-2, transition:{ duration:0.18 } }}
      className="rounded-2xl overflow-hidden"
      style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow,
               opacity: emp.active ? 1 : 0.55 }}>

      <div className="h-1 w-full" style={{ background:avatarGradient(role) }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-xl flex items-center justify-center text-lg font-black text-white"
              style={{ background:avatarGradient(role) }}>
              {initials(emp.name)}
            </div>
            <div className={`absolute -bottom-1 -left-1 h-4 w-4 rounded-full border-2 ${emp.active ? "bg-emerald-500" : "bg-slate-400"}`}
              style={{ borderColor:t.card }} />
          </div>

          {canEdit && (
            <div className="flex gap-1">
              <button onClick={onEdit}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background:`${ACC.indigo}12`, color:ACC.indigo }}
                title="تعديل">
                <Edit size={13} />
              </button>
              <button onClick={onToggle}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: emp.active ? `${ACC.amber}12` : `${ACC.emerald}12`,
                         color:      emp.active ? ACC.amber          : ACC.emerald }}
                title={emp.active ? "تعطيل" : "تفعيل"}>
                {emp.active ? <XCircle size={13}/> : <CheckCircle size={13}/>}
              </button>
              <button onClick={onDemote}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background:`${ACC.rose}12`, color:ACC.rose }}
                title="إزالة من الموظفين">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        <h3 className="font-black text-base mb-1" style={{ color:t.t1 }}>{emp.name}</h3>
        <p className="text-xs mb-2" style={{ color:t.t3 }}>{emp.email}</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background:`${meta.color}15`, color:meta.color, border:`1px solid ${meta.color}25` }}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background:t.card2, color:t.t2, border:`1px solid ${t.border}` }}>
            {emp.department}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3 text-center"
            style={{ background:t.card2, border:`1px solid ${t.border}` }}>
            <p className="text-lg font-black tabular-nums" style={{ color:t.t1 }}>{subCount}</p>
            <p className="text-[10px] font-medium" style={{ color:t.t3 }}>مشترك</p>
          </div>
          <div className="rounded-xl p-3 text-center"
            style={{ background:t.card2, border:`1px solid ${t.border}` }}>
            <p className="text-lg font-black tabular-nums" style={{ color:ACC.emerald }}>
              {canRev ? `$${formatNumber(revenue,0)}` : "—"}
            </p>
            <p className="text-[10px] font-medium" style={{ color:t.t3 }}>إيراد</p>
          </div>
        </div>

        {emp.notes && (
          <p className="mt-3 text-xs leading-relaxed" style={{ color:t.t2 }}>{emp.notes}</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function EmpModal({ initial, editUid, editName, onClose, onSave, t }:{
  initial: EmpForm;
  editUid?: string;
  editName?: string;
  onClose: ()=>void;
  onSave: (data:EmpForm, uid?:string)=>Promise<void>;
  t: typeof LT;
}) {
  const [form, setForm] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const isEdit = Boolean(editUid);

  function set<K extends keyof EmpForm>(k:K, v:EmpForm[K]) {
    setForm((f) => ({ ...f, [k]:v }));
  }

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    if (!isEdit) {
      if (!form.fullName.trim()) { setErr("الاسم الكامل مطلوب"); return; }
      if (!form.email.trim())    { setErr("البريد الإلكتروني مطلوب"); return; }
      if (form.password.length < 8) { setErr("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    }
    setSaving(true);
    try {
      await onSave(form, editUid);
      onClose();
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "حدث خطأ، حاول مرة أخرى";
      if (msg === "Email already registered") {
        setErr("هذا الإيميل مسجّل مسبقاً في النظام.");
      } else {
        setErr(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-md w-full" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
          <h3 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>
            {isEdit ? `تعديل: ${editName}` : "إضافة موظف جديد"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>}

          {!isEdit && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>
                  الاسم الكامل *
                </label>
                <input value={form.fullName} onChange={(e)=>set("fullName",e.target.value)}
                  className="form-input" placeholder="محمد أحمد" required />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>
                  البريد الإلكتروني *
                </label>
                <div className="relative">
                  <input value={form.email} onChange={(e)=>set("email",e.target.value)}
                    className="form-input" placeholder="employee@example.com" type="email" dir="ltr" required />
                  <Mail size={13} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>
                  كلمة المرور المؤقتة *
                  <span className="mr-1 font-normal opacity-60">(الموظف يغيّرها لاحقاً)</span>
                </label>
                <div className="relative">
                  <input
                    value={form.password}
                    onChange={(e)=>set("password",e.target.value)}
                    className="form-input pr-9"
                    placeholder="8 أحرف على الأقل"
                    type={showPass ? "text" : "password"}
                    dir="ltr"
                    required
                  />
                  <button
                    type="button"
                    onClick={()=>setShowPass((v)=>!v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
                  >
                    {showPass ? <EyeOff size={13}/> : <Eye size={13}/>}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>الدور</label>
              <select value={form.employeeRole} onChange={(e)=>set("employeeRole",e.target.value as EmployeeRole)} className="form-input">
                <option value="sales">مبيعات</option>
                <option value="followup">متابعة</option>
                <option value="admin">مدير</option>
                <option value="owner">مالك</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>القسم</label>
              <select value={form.department} onChange={(e)=>set("department",e.target.value as EmployeeDepartment)} className="form-input">
                {DEPARTMENTS.map((d)=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color:"var(--text-secondary)" }}>ملاحظات</label>
            <textarea value={form.notes} onChange={(e)=>set("notes",e.target.value)}
              className="form-input resize-none" rows={2} placeholder="اختياري..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-sm transition disabled:opacity-60"
              style={{ background:`linear-gradient(135deg,${ACC.indigo},${ACC.violet})` }}>
              <Save size={14} />
              {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الموظف"}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border text-sm font-semibold transition"
              style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user, can }  = useAuthStore();
  const { dark }       = useThemeStore();
  const t              = dark ? DT : LT;
  const isOwner        = user?.role === "owner";
  const canManage      = isOwner || can("canManageUsers");

  const { employees, loading } = useEmployees();
  const { subscribers }        = useSubscribers();

  type ModalState = null | "add" | { uid:string; name:string; form:EmpForm };
  const [modal, setModal]       = useState<ModalState>(null);
  const [confirmDel, setConfirmDel] = useState<UserProfile|null>(null);
  const [roleFilter, setRoleFilter] = useState<EmployeeRole|"">("");

  // ── Stats per employee (by name, matching convincedBy) ──────────────────────
  const empStats = useMemo(()=>{
    const m: Record<string,{ count:number; revenue:number }> = {};
    subscribers.forEach((s)=>{
      const key = s.convincedBy || "";
      if (!m[key]) m[key] = { count:0, revenue:0 };
      m[key].count++;
      m[key].revenue += s.netAmountUSD || 0;
    });
    return m;
  }, [subscribers]);

  // ── Overall stats ───────────────────────────────────────────────────────────
  const stats = useMemo(()=>({
    total:    employees.length,
    active:   employees.filter((e)=>e.active).length,
    sales:    employees.filter((e)=>e.employeeRole==="sales").length,
    followup: employees.filter((e)=>e.employeeRole==="followup").length,
  }), [employees]);

  const filtered = useMemo(()=>
    roleFilter ? employees.filter((e)=>e.employeeRole===roleFilter) : employees,
  [employees, roleFilter]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSave(data:EmpForm, uid?:string) {
    if (uid) {
      // Edit existing employee
      await callUserOperation("saveEmployee", {
        uid,
        employeeRole: data.employeeRole,
        department:   data.department,
        notes:        data.notes,
      });
    } else {
      // Create new employee (Auth + Firestore)
      await usersFeatureService.createEmployee({
        fullName:     data.fullName,
        email:        data.email,
        password:     data.password,
        employeeRole: data.employeeRole,
        department:   data.department,
        notes:        data.notes,
      });
    }
  }

  async function handleToggle(emp:UserProfile) {
    await callUserOperation("toggleEmployee", {
      uid: emp.uid,
      active: !emp.active,
    });
  }

  async function handleDemote(emp:UserProfile) {
    await callUserOperation("demoteEmployee", { uid: emp.uid });
    setConfirmDel(null);
  }

  return (
    <ProtectedLayout>
      <div className="min-h-full transition-colors duration-300" style={{ background:t.bg }}>
        <div className="mx-auto max-w-screen-xl p-5 md:p-7 lg:p-8">
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">

            {/* ── Header ── */}
            <motion.div variants={fadeUp} transition={tran}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="h-9 w-9 flex items-center justify-center rounded-xl"
                    style={{ background:`${ACC.indigo}18`, border:`1px solid ${ACC.indigo}28` }}>
                    <Users size={16} style={{ color:ACC.indigo }} />
                  </div>
                  <h1 className="text-xl font-black tracking-tight" style={{ color:t.t1 }}>إدارة الموظفين</h1>
                </div>
                <p className="text-sm" style={{ color:t.t2 }}>
                  {stats.total} موظف · {stats.active} نشط
                </p>
              </div>

              {canManage && (
                <button onClick={()=>setModal("add")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow"
                  style={{ background:`linear-gradient(135deg,${ACC.indigo},${ACC.violet})` }}>
                  <Plus size={16} />
                  إضافة موظف
                </button>
              )}
            </motion.div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard t={t} accent={ACC.indigo}  icon={<Users size={18}/>}     label="إجمالي الموظفين" value={stats.total} />
              <StatCard t={t} accent={ACC.emerald} icon={<UserCheck size={18}/>} label="نشطون"            value={stats.active} />
              <StatCard t={t} accent={ACC.amber}   icon={<Briefcase size={18}/>} label="فريق المبيعات"    value={stats.sales} />
              <StatCard t={t} accent={ACC.sky}     icon={<TrendingUp size={18}/>}label="فريق المتابعة"    value={stats.followup} />
            </div>

            {/* ── Performance leaderboard ── */}
            {Object.keys(empStats).length > 0 && (
              <motion.div variants={fadeUp} transition={tran}
                className="rounded-2xl overflow-hidden"
                style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
                <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor:t.border }}>
                  <Trophy size={15} style={{ color:ACC.amber }} />
                  <span className="font-bold text-sm" style={{ color:t.t1 }}>لوحة الأداء</span>
                </div>
                <div className="divide-y" style={{ borderColor:t.border }}>
                  {Object.entries(empStats)
                    .filter(([k]) => k)
                    .sort((a,b) => b[1].count - a[1].count)
                    .map(([name, s], i) => {
                      const medals = ["🥇","🥈","🥉"];
                      const total = Object.values(empStats).reduce((acc,v)=>acc+v.count,0);
                      const pct = total > 0 ? Math.round((s.count/total)*100) : 0;
                      const canRev = can("canViewRevenue");
                      return (
                        <div key={name} className="flex items-center gap-3 px-5 py-3">
                          <span className="text-base w-6 text-center shrink-0">
                            {i < 3 ? medals[i] : <span className="text-xs font-bold" style={{color:t.t3}}>{i+1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold truncate" style={{ color:t.t1 }}>{name}</span>
                              <span className="text-xs font-semibold tabular-nums" style={{ color:t.t2 }}>
                                {s.count} مشترك
                                {canRev && <span className="mr-2 text-emerald-500">${formatNumber(s.revenue,0)}</span>}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background:t.card2 }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width:`${pct}%`, background:`linear-gradient(90deg,${ACC.indigo},${ACC.violet})` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {/* ── Filter tabs ── */}
            <motion.div variants={fadeUp} transition={tran}
              className="flex gap-1 p-1 rounded-xl w-fit"
              style={{ background:t.card2, border:`1px solid ${t.border}` }}>
              {([["","الكل"], ["sales","مبيعات"], ["followup","متابعة"], ["admin","إدارة"]] as const).map(([v,l])=>(
                <button key={v} onClick={()=>setRoleFilter(v as EmployeeRole|"")}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: roleFilter===v ? t.card : "transparent",
                    color:      roleFilter===v ? t.t1   : t.t2,
                    boxShadow:  roleFilter===v ? t.shadow : "none",
                  }}>
                  {l}
                </button>
              ))}
            </motion.div>

            {/* ── Cards grid ── */}
            {loading ? (
              <div className="flex justify-center py-24">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor:`${ACC.indigo}40`, borderTopColor:ACC.indigo }} />
              </div>
            ) : filtered.length === 0 ? (
              <motion.div variants={fadeUp} transition={tran}
                className="flex flex-col items-center justify-center py-24 gap-3"
                style={{ color:t.t2 }}>
                <Users size={40} className="opacity-30" />
                <p className="font-semibold">لا يوجد موظفون</p>
                {canManage && (
                  <button onClick={()=>setModal("add")}
                    className="text-sm px-4 py-2 rounded-xl text-white"
                    style={{ background:ACC.indigo }}>
                    إضافة أول موظف
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div initial="hidden" animate="show" variants={stagger}
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((emp)=>(
                  <EmpCard
                    key={emp.uid} emp={emp} t={t}
                    subCount={empStats[emp.name]?.count ?? 0}
                    revenue={empStats[emp.name]?.revenue ?? 0}
                    canEdit={canManage}
                    onEdit={()=>setModal({
                      uid: emp.uid,
                      name: emp.name,
                      form: { fullName:"", password:"", email:emp.email, employeeRole:emp.employeeRole??"sales", department:emp.department??"مبيعات", notes:emp.notes??"" },
                    })}
                    onToggle={()=>handleToggle(emp)}
                    onDemote={()=>setConfirmDel(emp)}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Add / Edit modal ── */}
      <AnimatePresence>
        {modal && (
          <EmpModal
            key="emp-modal"
            t={t}
            initial={modal === "add" ? EMPTY : modal.form}
            editUid={modal === "add" ? undefined : modal.uid}
            editName={modal === "add" ? undefined : modal.name}
            onClose={()=>setModal(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* ── Demote confirm ── */}
      <AnimatePresence>
        {confirmDel && (
          <div className="modal-overlay" onClick={()=>setConfirmDel(null)}>
            <motion.div
              initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.95 }}
              transition={{ duration:0.2 }}
              className="modal-panel max-w-sm w-full p-6" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background:`${ACC.rose}15` }}>
                  <Trash2 size={18} style={{ color:ACC.rose }} />
                </div>
                <div>
                  <p className="font-bold" style={{ color:"var(--text-primary)" }}>إزالة من الموظفين</p>
                  <p className="text-xs" style={{ color:"var(--text-secondary)" }}>{confirmDel.name}</p>
                </div>
              </div>
              <p className="text-sm mb-6" style={{ color:"var(--text-secondary)" }}>
                سيُزال الموظف من القائمة ويُسحب وصوله. حسابه يبقى موجوداً.
              </p>
              <div className="flex gap-3">
                <button onClick={()=>handleDemote(confirmDel)}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm"
                  style={{ background:ACC.rose }}>
                  إزالة
                </button>
                <button onClick={()=>setConfirmDel(null)}
                  className="flex-1 py-2.5 rounded-xl border font-semibold text-sm"
                  style={{ borderColor:"var(--border)", color:"var(--text-secondary)" }}>
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
