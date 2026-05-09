"use client";

interface DiffViewProps {
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  changedFields?: string[];
}

const FIELD_LABELS: Record<string, string> = {
  status:             "الحالة",
  subscriptionStatus: "حالة الاشتراك",
  subscriptionState:  "نوع الاشتراك",
  role:               "الدور",
  active:             "نشط",
  name:               "الاسم",
  email:              "البريد",
  expiryDate:         "تاريخ الانتهاء",
  daysRemaining:      "أيام متبقية",
  paidAmount:         "المبلغ المدفوع",
  paidAmountUSD:      "المبلغ (USD)",
  package:            "الباقة",
  duration:           "المدة",
  permissions:        "الصلاحيات",
  granularPermissions:"الصلاحيات التفصيلية",
};

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean")  return val ? "نعم" : "لا";
  if (typeof val === "object")   return JSON.stringify(val, null, 2);
  return String(val);
}

export default function DiffView({ previousData, newData, changedFields }: DiffViewProps) {
  if (!previousData && !newData) return null;

  const keys = changedFields?.length
    ? changedFields
    : Array.from(
        new Set([
          ...Object.keys(previousData ?? {}),
          ...Object.keys(newData ?? {}),
        ])
      );

  if (keys.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
      <div className="grid grid-cols-[1fr_1fr_1fr] text-xs font-semibold bg-slate-100 text-slate-500">
        <div className="px-3 py-2">الحقل</div>
        <div className="px-3 py-2 bg-red-50 text-red-600">قبل</div>
        <div className="px-3 py-2 bg-emerald-50 text-emerald-700">بعد</div>
      </div>
      {keys.map((key) => {
        const prev = previousData?.[key];
        const next = newData?.[key];
        const changed = JSON.stringify(prev) !== JSON.stringify(next);
        return (
          <div
            key={key}
            className={`grid grid-cols-[1fr_1fr_1fr] text-xs border-t border-slate-100 ${
              changed ? "bg-amber-50/40" : ""
            }`}
          >
            <div className="px-3 py-2 font-medium text-slate-700">
              {FIELD_LABELS[key] ?? key}
            </div>
            <div className={`px-3 py-2 font-mono text-slate-500 whitespace-pre-wrap break-all ${
              changed ? "text-red-600 bg-red-50/60" : ""
            }`}>
              {renderValue(prev)}
            </div>
            <div className={`px-3 py-2 font-mono text-slate-700 whitespace-pre-wrap break-all ${
              changed ? "text-emerald-700 bg-emerald-50/60" : ""
            }`}>
              {renderValue(next)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
