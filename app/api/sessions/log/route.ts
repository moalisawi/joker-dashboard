import { NextResponse }          from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { verifyServerUser, initializeAdminApp } from "@/lib/serverAuth";
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
// Prefer edge-provided headers (Vercel / Cloudflare / AWS).
// Falls back to ip-api.com for self-hosted deployments.

const geoCache = new Map<string, { country?: string; city?: string }>();

async function getGeo(ip: string, request: Request): Promise<{ country?: string; city?: string }> {
  // Edge/CDN geo headers — zero latency
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code") ??
    undefined;
  const city =
    request.headers.get("x-vercel-ip-city") ??
    request.headers.get("x-city") ??
    undefined;
  if (country) return { country, city };

  // Skip private / local IPs
  if (!ip || ip === "Unknown" || /^(127\.|::1$|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip)) {
    return { country: "Local", city: undefined };
  }

  if (geoCache.has(ip)) return geoCache.get(ip)!;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 2000);
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as { status: string; country?: string; city?: string };
      if (data.status === "success") {
        const result = { country: data.country, city: data.city };
        geoCache.set(ip, result);
        return result;
      }
    }
  } catch {
    // Non-fatal
  }
  return {};
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  initializeAdminApp();

  const user = await verifyServerUser(request);
  console.log("[sessions/log] POST — user:", user?.uid ?? "null (unauthorized)");
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const ua = request.headers.get("user-agent") || "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "Unknown";

  const parsed = parseUA(ua);
  const geo    = await getGeo(ip, request);

  try {
    const userSnap  = await getFirestore().collection("users").doc(user.uid).get();
    const userData  = userSnap.data();
    const now       = FieldValue.serverTimestamp();

    const docRef = await getFirestore().collection("loginSessions").add({
      uid:            user.uid,
      email:          user.email || "",
      displayName:    userData?.name || userData?.email || user.email || "",
      role:           user.role,
      status:         "active",
      isActive:       true,
      loginAt:        now,
      lastSeenAt:     now,
      createdAt:      now,
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
    });

    return NextResponse.json({ success: true, sessionId: docRef.id });
  } catch (err) {
    console.error("[sessions/log]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
