"use client";

import { useEffect } from "react";
import Link from "next/link";
import ErrorScreen from "@/components/ui/ErrorScreen";
import { reportError } from "@/lib/reportError";

/**
 * Route-level error boundary.
 *
 * Catches uncaught exceptions thrown while rendering any page under app/.
 * Without this file Next.js renders a blank screen in production, so every
 * page-level crash became invisible to the user and to us.
 *
 * The root layout still renders around this, so providers stay mounted and
 * `reset()` can re-render the failed segment without a full page reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      scope: "react-boundary",
      source: "app/error.tsx",
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
    <ErrorScreen
      title="حدث خطأ غير متوقع"
      description="واجه النظام مشكلة أثناء عرض هذه الصفحة. بياناتك لم تتأثر — جرّب إعادة المحاولة، وإذا تكرر الخطأ أبلغ المسؤول."
      detail={detail}
      actions={
        <>
          <button type="button" className="jk-btn" onClick={() => reset()}>
            إعادة المحاولة
          </button>
          <Link className="jk-btn secondary" href="/">
            العودة للوحة التحكم
          </Link>
        </>
      }
    />
  );
}
