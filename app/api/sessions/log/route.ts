import { NextResponse }          from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, initializeAdminApp } from "@/lib/serverAuth";
import { hasAdminCredentials } from "@/lib/serverFirestore";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { DeviceType } from "@/types";

export const runtime = "nodejs";

// ── UA parser ────────────────────────────────────────────────────────────────

type ParsedUA = {
  browser:        string;
  browserVersion?: string;
  os:             string;
  osVersion?:     string;
  device:         DeviceType;
};

function parseUA(ua: string): ParsedUA {
  let device: DeviceType = "desktop";
  let os = "Unknown";
  let osVersion: string | undefined;
  let browser = "Unknown";
  let browserVersion: string | undefined;

  // ── device + OS ──────────────────────────────────────────────────────────
  if (/iPad/i.test(ua)) {
    device = "tablet"; os = "iOS";
    osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace("_", ".");
  } else if (/iPhone|iPod/i.test(ua)) {
    device = "mobile"; os = "iOS";
    osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace("_", ".");
  } else if (/Android/i.test(ua)) {
    device = /Mobile/i.test(ua) ? "mobile" : "tablet";
    os = "Android";
    osVersion = ua.match(/Android (\d+\.?\d*)/)?.[1];
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
    const nt = ua.match(/Windows NT (\d+\.\d+)/)?.[1];
    const map: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista" };
    osVersion = map[nt ?? ""] ?? nt;
  } else if (/Mac OS X/i.test(ua)) {
    os = "macOS";
    osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace("_", ".");
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // ── browser ──────────────────────────────────────────────────────────────
  if (/Edg\/(\d+)/i.test(ua)) {
    browser = "Edge";
    browserVersion = ua.match(/Edg\/(\d+)/i)?.[1];
  } else if (/OPR\/(\d+)/i.test(ua)) {
    browser = "Opera";
    browserVersion = ua.match(/OPR\/(\d+)/i)?.[1];
  } else if (/SamsungBrowser\/(\d+)/i.test(ua)) {
    browser = "Samsung";
    browserVersion = ua.match(/SamsungBrowser\/(\d+)/i)?.[1];
  } else if (/Chrome\/(\d+)/i.test(ua)) {
    browser = "Chrome";
    browserVersion = ua.match(/Chrome\/(\d+)/i)?.[1];
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = "Firefox";
    browserVersion = ua.match(/Firefox\/(\d+)/i)?.[1];
  } else if (/Version\/(\d+).*Safari/i.test(ua)) {
    browser = "Safari";
    browserVersion = ua.match(/Version\/(\d+)/i)?.[1];
  }

  return { browser, browserVersion, os, osVersion, device };
}

// ── Geo lookup ────────────────────────────────────────────────────────────────
// Uses only CDN/edge-provided headers. No external HTTP calls — they add
// latency, expose user IPs over unencrypted connections, and fail under load.
// Vercel: x-vercel-ip-country / x-vercel-ip-city (automatic)
// Cloudflare: cf-ipcountry
// AWS CloudFront: x-country-code

function getGeo(request: Request): { country?: string; city?: string } {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code") ??
    undefined;
  const city =
    request.headers.get("x-vercel-ip-city") ??
    request.headers.get("x-city") ??
    undefined;
  return { country, city };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  initializeAdminApp();

  // Rate limit: 5 session log requests per IP per minute (one per login)
  const ip = getClientIp(request);
  if (!checkRateLimit(`session-log:${ip}`, 5, 60 * 1000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const user = await verifyServerUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Session logging writes via Admin SDK only (firestore.rules denies client writes).
  // Without admin credentials in dev, the write hangs ~10s on metadata-server timeout
  // before failing — return early so the client doesn't block on it.
  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { success: false, skipped: true, reason: "admin-credentials-unavailable" },
      { status: 202 }
    );
  }

  const ua = request.headers.get("user-agent") || "";
  const parsed = parseUA(ua);
  const geo    = getGeo(request);

  try {
    const userSnap  = await getFirestore().collection("users").doc(user.uid).get();
    const userData  = userSnap.data();
    const now       = FieldValue.serverTimestamp();

    // Sessions expire after 8 hours of inactivity.
    // The heartbeat endpoint resets expiresAt on each ping.
    // A background job or Cloud Function should mark stale sessions as timed_out
    // by querying where("expiresAt", "<", now) periodically.
    const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    // Strip undefined fields — Firestore rejects them
    const sessionData = Object.fromEntries(
      Object.entries({
        uid:            user.uid,
        email:          user.email || "",
        displayName:    userData?.name || userData?.email || user.email || "",
        role:           user.role,
        status:         "active",
        isActive:       true,
        loginAt:        now,
        lastSeenAt:     now,
        createdAt:      now,
        expiresAt,
        ipAddress:      ip,
        country:        geo.country,
        city:           geo.city,
        userAgent:      ua,
        browser:        parsed.browser,
        browserVersion: parsed.browserVersion,
        os:             parsed.os,
        osVersion:      parsed.osVersion,
        device:         parsed.device,
        isSuspicious:   false,
      }).filter(([, v]) => v !== undefined)
    );

    const docRef = await getFirestore().collection("loginSessions").add(sessionData);

    return NextResponse.json({ success: true, sessionId: docRef.id });
  } catch (err) {
    console.error("[sessions/log]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
