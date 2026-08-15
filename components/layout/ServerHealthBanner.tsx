"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { auth } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { canReadUserDirectory } from "@/lib/permissionGuards";

interface Health {
  canWrite: boolean;
  missing: string[];
  message: string;
}

/**
 * Announces a deployment that can read but cannot write.
 *
 * Twice now this project has run in production with a broken server config and
 * no sign of it on any screen: a placeholder Firebase key that blocked every
 * login for three months, and — found on 14 Aug 2026 — missing Admin SDK
 * credentials that made every save return 503 while the whole app browsed
 * normally.
 *
 * That is the failure worth engineering against. Reads working is exactly what
 * makes it invisible; the operator only learns when a payment they just
 * recorded refuses to save, and by then they distrust the app rather than the
 * config. This says it on arrival instead.
 *
 * Staff only — an employee cannot fix a Vercel variable, and a red bar they
 * cannot act on is just noise. It is deliberately not dismissible: the
 * condition is not an annoyance to acknowledge, it is a broken deployment.
 */
export default function ServerHealthBanner() {
  const { user } = useAuthStore();
  const isStaff = canReadUserDirectory(user);

  const { data } = useQuery<Health | null>({
    queryKey: ["health", "config"],
    enabled: isStaff,
    // Checked once per session rather than polled: the answer only changes on a
    // redeploy, which reloads the page anyway.
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return null;
      const res = await fetch("/api/health/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as Health;
    },
  });

  if (!data || data.canWrite) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-4 py-2.5 text-xs"
      style={{ background: "#EF444412", borderBottom: "1px solid #EF444433", color: "var(--text-secondary)" }}
    >
      <AlertTriangle size={15} style={{ color: "#EF4444" }} className="shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-bold" style={{ color: "#EF4444" }}>
          الحفظ معطّل على هذا الخادم — {data.message}
        </p>
        <p className="mt-0.5 leading-relaxed">
          التصفّح والقراءة تعملان، لكن أي إنشاء أو دفعة أو تجديد أو تعديل مستخدم سيفشل.
          {data.missing.length > 0 && (
            <> المتغيّرات الناقصة: <code dir="ltr">{data.missing.join(", ")}</code>.</>
          )}{" "}
          أضِف <code dir="ltr">FIREBASE_CLIENT_EMAIL</code> و<code dir="ltr">FIREBASE_PRIVATE_KEY_B64</code> في
          إعدادات المشروع على Vercel ثم أعِد النشر.
        </p>
      </div>
    </div>
  );
}
