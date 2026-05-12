"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { UserProfile } from "@/types";
import type { EmployeeRole } from "@/types";

interface Options {
  activeOnly?: boolean;
  role?: EmployeeRole;
}

export function useEmployees({ activeOnly = false, role }: Options = {}) {
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("isEmployee", "==", true),
      orderBy("name", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let data = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
        if (activeOnly) data = data.filter((e) => e.active !== false);
        if (role)       data = data.filter((e) => e.employeeRole === role);
        setEmployees(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [activeOnly, role]);

  return { employees, loading };
}
