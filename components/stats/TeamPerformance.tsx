"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { EMPLOYEES } from "@/lib/permissions";

const EMP_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  حنان:  { bg: "bg-purple-100", text: "text-purple-700", bar: "bg-purple-500" },
  ميار:  { bg: "bg-teal-100",   text: "text-teal-700",   bar: "bg-teal-500"   },
  ميدو:  { bg: "bg-orange-100", text: "text-orange-700", bar: "bg-orange-500" },
};

interface Props {
  subscribers: Subscriber[];
}

export default function TeamPerformance({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const stats = useMemo(() => {
    return EMPLOYEES.map((emp) => {
      const data = subscribers.filter((s) => s.convincedBy === emp);
      return {
        name: emp,
        count: data.length,
        revenue: data.reduce((sum, s) => sum + s.netAmountUSD, 0),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [subscribers]);

  const maxRevenue = Math.max(...stats.map((s) => s.revenue), 1);
  const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);

  if (!canRev) {
    return (
      <div className="text-center text-slate-400 py-8 text-sm">
        تقارير الإيرادات متاحة للإدارة فقط
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats.map((s, i) => {
        const style = EMP_STYLES[s.name] || { bg: "bg-slate-100", text: "text-slate-700", bar: "bg-blue-500" };
        const pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
        return (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-4">#{i + 1}</span>
                <span className={`${style.bg} ${style.text} px-2.5 py-1 rounded-lg text-sm font-bold`}>
                  {s.name}
                </span>
                <span className="text-xs text-slate-500">{s.count} مشترك</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800 text-sm">${formatNumber(s.revenue, 2)}</p>
                <p className="text-xs text-slate-400">{pct.toFixed(1)}%</p>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                style={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
