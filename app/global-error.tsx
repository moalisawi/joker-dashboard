"use client";

import { useEffect } from "react";
import "./globals.css";
import ErrorScreen from "@/components/ui/ErrorScreen";
import { reportError } from "@/lib/reportError";

/**
 * Last-resort error boundary — catches failures in the root layout itself
 * (providers, fonts, theme). Next.js replaces the whole document when this
 * renders, so it must supply its own <html>/<body> and cannot rely on
 * anything mounted in app/layout.tsx.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      scope: "react-root-boundary",
      source: "app/global-error.tsx",
      digest: error.digest,
    });
  }, [error]);

  const detail =
    process.env.NODE_ENV === "development"
      ? error.stack || error.message
      : error.digest
        ? `digest: ${error.digest}`
        : undefined;

  return (
    <html lang="ar" dir="rtl">
      <body>
        <ErrorScreen
          title="تعذّر تحميل النظام"
          description="حدث خطأ جذري منع تحميل واجهة النظام. أعد المحاولة، وإذا استمرّت المشكلة تواصل مع المسؤول التقني."
          detail={detail}
          actions={
            <>
              <button type="button" className="jk-btn" onClick={() => reset()}>
                إعادة المحاولة
              </button>
              {/* Hard navigation on purpose — the router itself may be part of
                  what failed, so next/link is not safe to rely on here. */}
              <button
                type="button"
                className="jk-btn secondary"
                onClick={() => { window.location.href = "/"; }}
              >
                العودة للوحة التحكم
              </button>
            </>
          }
        />
      </body>
    </html>
  );
}
