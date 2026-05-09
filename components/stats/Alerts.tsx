"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  subscribers: Subscriber[];
}

export default function Alerts({ subscribers }: Props) {
  const alerts = useMemo(() => {
    return subscribers
      .filter(
        (s) =>
          s.subscriptionState !== "withdrawn" &&
          s.subscriptionStatus !== "paused" &&
          s.freezeData?.isFrozen !== true &&
          (s.status === "ينتهي قريباً" || s.status === "منتهي")
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8);
  }, [subscribers]);

  if (alerts.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-slate-400 text-sm">لا توجد تنبيهات</div>
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {alerts.map((s) => {
        const expired = s.status === "منتهي";
        const label = expired
          ? `منتهي منذ ${Math.abs(s.daysRemaining)} يوم`
          : `ينتهي خلال ${s.daysRemaining} يوم`;

        return (
          <div
            key={s.id}
            className="flex items-center justify-between px-5 py-3 hover:bg-orange-50/40 transition"
          >
            <div>
              <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
              <p className="text-xs text-slate-500">
                {s.dialCode}{s.phone} · {s.package}
              </p>
            </div>
            <div className="text-left">
              <span
                className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  expired
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {label}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                {s.convincedBy || "-"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
