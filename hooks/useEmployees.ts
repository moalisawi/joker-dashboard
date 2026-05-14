"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { UserProfile } from "@/types";
import type { EmployeeRole } from "@/types";

interface Options {
  activeOnly?: boolean;
  role?:       EmployeeRole;
}

export function useEmployees({ activeOnly = false, role }: Options = {}) {
  const qc       = useQueryClient();
  const queryKey = ["employees", activeOnly, role ?? ""] as const;

  const { data: employees = [], isLoading } = useQuery<UserProfile[]>({
    queryKey,
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("isEmployee", "==", true), orderBy("name", "asc"))
      );
      let data = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      if (activeOnly) data = data.filter((e) => e.active !== false);
      if (role)       data = data.filter((e) => e.employeeRole === role);
      return data;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const q = query(collection(db, "users"), where("isEmployee", "==", true), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      if (activeOnly) data = data.filter((e) => e.active !== false);
      if (role)       data = data.filter((e) => e.employeeRole === role);
      qc.setQueryData<UserProfile[]>(queryKey, data);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, role]);

  return { employees, loading: isLoading };
}
