"use client";

import { useEmployeeCardStore } from "@/store/employeeCardStore";

interface Props {
  name:      string;
  uid?:      string | null;
  className?: string;
  /** Extra inline style passed to the element */
  style?:    React.CSSProperties;
}

/**
 * Renders an employee name.
 * When a uid is provided the name becomes a clickable chip that opens
 * the EmployeeQuickCard overlay; otherwise it renders as plain text.
 */
export default function EmployeeNameChip({ name, uid, className = "", style }: Props) {
  const open = useEmployeeCardStore((s) => s.open);

  if (!uid) {
    return (
      <span className={className} style={style}>
        {name}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(uid); }}
      className={`transition-opacity hover:opacity-70 cursor-pointer ${className}`}
      style={style}>
      {name}
    </button>
  );
}
