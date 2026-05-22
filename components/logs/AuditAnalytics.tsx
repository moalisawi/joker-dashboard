"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import type { NormalizedAuditLog } from "@/types";

interface AuditAnalyticsProps {
  logs: NormalizedAuditLog[];
}

const ACTION_LABELS: Record<string, string> = {
  subscriber_created:   "إضافة مشترك",
  subscriber_updated:   "تعديل مشترك",
  subscriber_renewed:   "تجديد",
  subscriber_frozen:    "تجميد",
  subscriber_resumed:   "استئناف",
  subscriber_withdrawn: "انسحاب",
  subscriber_deleted:   "حذف مشترك",
  payment_created:      "دفعة",
  refund_created:       "استرداد",
  user_created:         "مستخدم جديد",
  role_changed:         "تغيير دور",
  permissions_changed:  "صلاحيات",
  login_failed:         "فشل دخول",
  login_success:        "دخول ناجح",
};

const SEVERITY_COLORS: Record<string, string> = {
  success:  "#5B5FEF",
  info:     "#5B5FEF",
  warning:  "#F59E0B",
  critical: "#EF4444",
};

const CATEGORY_COLORS: Record<string, string> = {
  subscriber: "#5B5FEF",
  financial:  "#5B5FEF",
  user:       "#F59E0B",
  auth:       "#EF4444",
  system:     "#9ca3af",
};

const CATEGORY_LABELS: Record<string, string> = {
  subscriber: "مشتركون",
  financial:  "مالي",
  user:       "مستخدمون",
  auth:       "أمان",
  system:     "نظام",
};

export default function AuditAnalytics({ logs }: AuditAnalyticsProps) {
  const { topActions, byAdmin, bySeverity, byCategory, criticalEvents, refundByAdmin } = useMemo(() => {
    const actionCount: Record<string, number> = {};
    const adminCount:  Record<string, number> = {};
    const severityCount: Record<string, number> = { success: 0, info: 0, warning: 0, critical: 0 };
    const categoryCount: Record<string, number> = {};
    const refundAdmin:   Record<string, { count: number; totalUSD: number }> = {};
    const criticals: NormalizedAuditLog[] = [];

    for (const log of logs) {
      // top actions
      actionCount[log.action] = (actionCount[log.action] ?? 0) + 1;

      // by admin
      const name = log._performedByName || "—";
      adminCount[name] = (adminCount[name] ?? 0) + 1;

      // severity
      const sev = log.severity ?? "info";
      severityCount[sev] = (severityCount[sev] ?? 0) + 1;

      // category
      const cat = log.category ?? "system";
      categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;

      // critical
      if (log.severity === "critical") criticals.push(log);

      // refunds by admin
      if (log.action === "refund_created" && log.financialData?.amountUSD) {
        if (!refundAdmin[name]) refundAdmin[name] = { count: 0, totalUSD: 0 };
        refundAdmin[name].count++;
        refundAdmin[name].totalUSD += log.financialData.amountUSD;
      }
    }

    const topActions = Object.entries(actionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([action, count]) => ({ action: ACTION_LABELS[action] ?? action, count }));

    const byAdmin = Object.entries(adminCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    const bySeverity = Object.entries(severityCount)
      .filter(([, c]) => c > 0)
      .map(([name, value]) => ({
        name: name === "success" ? "ناجح" : name === "info" ? "معلومة" : name === "warning" ? "تحذير" : "حرج",
        value,
        color: SEVERITY_COLORS[name],
      }));

    const byCategory = Object.entries(categoryCount)
      .filter(([, c]) => c > 0)
      .map(([name, count]) => ({
        name: CATEGORY_LABELS[name] ?? name,
        count,
        color: CATEGORY_COLORS[name] ?? "#9ca3af",
      }));

    const refundByAdmin = Object.entries(refundAdmin)
      .sort((a, b) => b[1].totalUSD - a[1].totalUSD)
      .slice(0, 5)
      .map(([name, d]) => ({ name, ...d }));

    return { topActions, byAdmin, bySeverity, byCategory, criticalEvents: criticals.slice(0, 5), refundByAdmin };
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        لا توجد بيانات كافية لعرض التحليلات
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* top row: top actions + severity pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* top actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">أكثر العمليات تكراراً</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topActions} layout="vertical" margin={{ right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="action" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [`${v} عملية`, ""]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {topActions.map((_, i) => (
                  <Cell key={i} fill={`hsl(${220 + i * 15}, 70%, 55%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* severity distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">توزيع مستوى الخطورة</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={bySeverity}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {bySeverity.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [`${v} سجل`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* second row: most active admins + category distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* by admin */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">الأكثر نشاطاً</h3>
          <div className="space-y-2">
            {byAdmin.map(({ name, count }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
                    <span className="text-xs text-slate-500 shrink-0 mr-2">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all"
                      style={{ width: `${(count / (byAdmin[0]?.count ?? 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* by category */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">توزيع الفئات</h3>
          <div className="space-y-2.5">
            {byCategory.map(({ name, count, color }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-slate-700">{name}</span>
                    <span className="text-xs text-slate-500">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / (byCategory.reduce((s, c) => s + c.count, 0))) * 100}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* refunds by admin */}
      {refundByAdmin.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">الاستردادات حسب المسؤول</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
                  <th className="px-3 py-2 text-right">المسؤول</th>
                  <th className="px-3 py-2 text-right">عدد الاستردادات</th>
                  <th className="px-3 py-2 text-right">إجمالي (USD)</th>
                </tr>
              </thead>
              <tbody>
                {refundByAdmin.map(({ name, count, totalUSD }, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-700">{name}</td>
                    <td className="px-3 py-2 text-slate-500">{count}</td>
                    <td className="px-3 py-2 text-red-600 font-semibold">−${totalUSD.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* critical events */}
      {criticalEvents.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-red-700 mb-3">آخر الأحداث الحرجة</h3>
          <div className="space-y-2">
            {criticalEvents.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-2 bg-red-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <p className="text-sm text-red-800 font-medium truncate">
                    {log._description || log.action}
                  </p>
                  <p className="text-xs text-red-500">{log._performedByName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
