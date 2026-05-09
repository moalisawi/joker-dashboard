"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { getWhatsAppLink } from "@/lib/utils";

interface Props {
  subscribers: Subscriber[];
}

export default function Expiry15Days({ subscribers }: Props) {
  const expiring = useMemo(() => {
    return subscribers
      .filter(
        (s) =>
          s.subscriptionState !== "withdrawn" &&
          s.subscriptionStatus !== "paused" &&
          s.freezeData?.isFrozen !== true &&
          s.daysRemaining > 7 &&
          s.daysRemaining <= 15
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [subscribers]);

  if (expiring.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm mb-6">
      <div className="px-5 py-4 border-b border-amber-50 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <h3 className="font-bold text-slate-800">
          تنتهي خلال 8–15 يوم
        </h3>
        <span className="mr-auto text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
          {expiring.length}
        </span>
      </div>

      <div className="divide-y divide-slate-50">
        {expiring.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between flex-wrap gap-2 px-5 py-3 hover:bg-amber-50/40 transition"
          >
            <div>
              <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
              <p className="text-xs text-slate-500" dir="ltr">
                {s.dialCode}{s.phone} · {s.package}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800">
                ينتهي خلال {s.daysRemaining} يوم
              </span>
              <a
                href={getWhatsAppLink(s.dialCode, s.phone)}
                target="_blank"
                rel="noopener"
                className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-semibold"
              >
                📱 واتساب
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
