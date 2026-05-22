"use client";

import { PERMISSION_LABELS } from "@/types";
import { EMPLOYEE_ROLE_PERMISSIONS, DEFAULT_GRANULAR_PERMISSIONS } from "@/lib/permissions";
import type { GranularPermissions } from "@/types";
import type { EmployeeRole } from "@/types";

interface Props {
  value: GranularPermissions;
  onChange: (v: GranularPermissions) => void;
  readOnly?: boolean;
}

type Category = keyof GranularPermissions;

const CATEGORIES = Object.keys(PERMISSION_LABELS) as Category[];

const ROLE_PRESETS: { label: string; value: EmployeeRole }[] = [
  { label: "مبيعات",  value: "sales"   },
  { label: "متابعة",  value: "followup" },
  { label: "مدير",    value: "admin"   },
];

export default function PermissionsEditor({ value, onChange, readOnly }: Props) {
  function toggle(cat: Category, action: string) {
    const catObj = value[cat] as Record<string, boolean>;
    onChange({
      ...value,
      [cat]: { ...catObj, [action]: !catObj[action] },
    });
  }

  function toggleAll(cat: Category) {
    const catObj   = value[cat] as Record<string, boolean>;
    const actions  = Object.keys(catObj);
    const allOn    = actions.every((a) => catObj[a]);
    const newCat   = Object.fromEntries(actions.map((a) => [a, !allOn]));
    onChange({ ...value, [cat]: newCat as never });
  }

  function applyPreset(role: EmployeeRole) {
    onChange(EMPLOYEE_ROLE_PERMISSIONS[role]);
  }

  function resetToDefault() {
    onChange(DEFAULT_GRANULAR_PERMISSIONS.employee);
  }

  return (
    <div className="space-y-3">
      {/* Preset bar */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold self-center ml-1" style={{ color: "var(--text-secondary)" }}>
            قوالب جاهزة:
          </span>
          {ROLE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => applyPreset(p.value)}
              className="px-3 py-1 rounded-lg text-xs font-bold border transition-all hover:opacity-80"
              style={{ borderColor: "#5B5FEF40", color: "#5B5FEF", background: "#5B5FEF10" }}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetToDefault}
            className="px-3 py-1 rounded-lg text-xs font-bold border transition-all hover:opacity-80 mr-auto"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            إعادة تعيين
          </button>
        </div>
      )}

      {/* Permission groups */}
      {CATEGORIES.map((cat) => {
        const meta    = PERMISSION_LABELS[cat];
        const catObj  = value[cat] as Record<string, boolean>;
        const actions = Object.keys(catObj);
        const allOn   = actions.every((a) => catObj[a]);
        const someOn  = actions.some((a) => catObj[a]);

        return (
          <div
            key={cat}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Category header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {meta.label}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggleAll(cat)}
                  className="text-xs font-semibold px-2 py-0.5 rounded-md transition-colors"
                  style={{
                    background: allOn ? "#5B5FEF18" : someOn ? "#F59E0B18" : "transparent",
                    color:      allOn ? "#5B5FEF"   : someOn ? "#F59E0B"   : "var(--text-muted)",
                  }}
                >
                  {allOn ? "إلغاء الكل" : "تحديد الكل"}
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 p-3" style={{ background: "var(--surface)" }}>
              {actions.map((action) => {
                const checked = catObj[action];
                return (
                  <label
                    key={action}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${readOnly ? "cursor-default" : "hover:bg-slate-50"}`}
                    style={{
                      background: checked ? "#5B5FEF10" : "transparent",
                      border: `1px solid ${checked ? "#5B5FEF30" : "var(--border)"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => !readOnly && toggle(cat, action)}
                      className="w-3.5 h-3.5 accent-indigo-500 shrink-0"
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: checked ? "#5B5FEF" : "var(--text-secondary)" }}
                    >
                      {meta.actions[action] ?? action}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
