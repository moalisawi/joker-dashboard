/**
 * Single entry point for reporting unexpected errors.
 *
 * The project has no monitoring provider wired up, so production failures are
 * only visible if someone happens to have the console open. Rather than scatter
 * `console.error` across boundaries and route handlers, every report goes
 * through here — adding Sentry (or any other provider) later means editing one
 * function instead of hunting down call sites.
 *
 * Two behaviours, both optional and both fail-safe:
 *
 *  1. Structured console output — always on.
 *  2. HTTP forwarding — enabled by setting NEXT_PUBLIC_ERROR_REPORT_URL to an
 *     endpoint that accepts a JSON POST. Off when the variable is absent.
 *
 * This function must never throw: it runs inside catch blocks and error
 * boundaries, where a second failure would mask the original one.
 */

export type ErrorScope =
  | "react-boundary"
  | "react-root-boundary"
  | "api-route"
  | "service"
  | "unknown";

export interface ErrorReport {
  scope: ErrorScope;
  /** Where it happened — route path, handler name, service method. */
  source?: string;
  /** Next.js error digest, when the boundary provides one. */
  digest?: string;
  /** Any extra context worth keeping. Must be JSON-serialisable. */
  extra?: Record<string, unknown>;
}

interface NormalisedError {
  name: string;
  message: string;
  stack?: string;
}

function normalise(error: unknown): NormalisedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  try {
    return { name: "UnknownError", message: JSON.stringify(error) };
  } catch {
    return { name: "UnknownError", message: String(error) };
  }
}

function endpoint(): string | undefined {
  const url = process.env.NEXT_PUBLIC_ERROR_REPORT_URL;
  return url && url.length > 0 ? url : undefined;
}

/** Sends the payload without blocking or throwing. Best effort by design. */
function forward(url: string, payload: unknown): void {
  const body = JSON.stringify(payload);

  try {
    // In the browser, sendBeacon survives a page unload — which is exactly when
    // a crash report is most likely to be lost.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* reporting failures are never surfaced */
    });
  } catch {
    /* reporting failures are never surfaced */
  }
}

export function reportError(error: unknown, report: ErrorReport): void {
  const normalised = normalise(error);

  const payload = {
    ...normalised,
    ...report,
    environment: process.env.NODE_ENV,
    runtime: typeof window === "undefined" ? "server" : "client",
    url: typeof window === "undefined" ? undefined : window.location.href,
    reportedAt: new Date().toISOString(),
  };

  console.error(`[${report.scope}]${report.source ? ` ${report.source}` : ""}`, payload);

  const url = endpoint();
  if (url) forward(url, payload);
}
