"use client";

import { useMemo } from "react";
import { useActiveEmployees } from "@/features/users/hooks";

/**
 * Returns a deduplicated, sorted list of employee display names.
 * Replaces the hardcoded EMPLOYEES constant — names now come from Firestore.
 * Falls back to an empty array while loading.
 */
export function useEmployeeNames(): string[] {
  const { data: employees = [] } = useActiveEmployees();

  return useMemo(() => {
    const names = employees
      .map((e) => e.employeeName || e.name || "")
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "ar"));
  }, [employees]);
}
