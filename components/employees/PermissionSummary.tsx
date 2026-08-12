"use client";

import { Check, ShieldOff } from "lucide-react";
import { describePermissions } from "@/lib/permissions";
import type { GranularPermissions, Role, EmployeeRole } from "@/types";

/**
 * "هذا المستخدم يستطيع…" — the checkbox grid stated in sentences.
 *
 * The grid answers what is stored; nobody reads twenty checkboxes and arrives at
 * an understanding of what the person will actually be able to do. This does,
 * and it reads the *effective* permissions — grant clamped by ROLE_CEILING — so
 * a preset asking for more than the role allows is shown at its real value
 * rather than at what was ticked.
 */
export default function PermissionSummary({
  role,
  employeeRole,
  granularPermissions,
  title = "هذا المستخدم يستطيع",
  compact = false,
}: {
  role: Role;
  employeeRole?: EmployeeRole | null;
  granularPermissions?: GranularPermissions | null;
  title?: string;
  compact?: boolean;
}) {
  const lines = describePermissions({ role, employeeRole, granularPermissions });

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <p className="text-[11px] font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>

      {lines.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <ShieldOff size={12} />
          لا شيء — الحساب بلا صلاحيات فعّالة.
        </p>
      ) : (
        <ul className={compact ? "grid grid-cols-1 gap-1 sm:grid-cols-2" : "space-y-1"}>
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Check size={12} className="shrink-0 mt-0.5" style={{ color: "#5B5FEF" }} />
              {line}
            </li>
          ))}
        </ul>
      )}

      {role === "owner" && (
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
          حساب المالك يتجاوز كل القيود — الصلاحيات المعروضة أعلاه للتوضيح فقط.
        </p>
      )}
    </div>
  );
}
