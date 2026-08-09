import { NextResponse }              from "next/server";
import { FieldValue, getFirestore }  from "firebase-admin/firestore";
import { requireAuth }               from "@/lib/requirePermission";
import { hasAdminCredentials, fsAdd } from "@/lib/serverFirestore";
import { getBearerToken }            from "@/lib/serverAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { z }                         from "zod";

export const runtime = "nodejs";

/**
 * Server-side writer for the `auditLogs` collection.
 *
 * Why this route exists: firestore.rules declares `allow write: if false` on
 * auditLogs (audit records must not be forgeable by a client). The client
 * audit service used to call addDoc() directly, so every write was rejected and
 * the error was swallowed by a console.warn — the audit trail silently recorded
 * nothing for any action that did not go through another API route.
 *
 * Writes here use the Admin SDK, which bypasses the rules by design.
 *
 * Identity is taken from the verified ID token, never from the request body, so
 * a caller cannot attribute an action to someone else.
 */

const performedBySchema = z.object({
  uid:   z.string().optional(),
  name:  z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  role:  z.string().max(50).optional(),
});

const bodySchema = z.object({
  action:      z.string().min(1).max(100),
  category:    z.string().max(50),
  severity:    z.string().max(30),
  source:      z.string().max(30).optional(),

  entityType:  z.string().max(50).optional(),
  entityId:    z.string().max(200).optional(),
  entityName:  z.string().max(300).optional(),
  description: z.string().max(1000).optional(),

  previousData:  z.record(z.string(), z.unknown()).nullable().optional(),
  newData:       z.record(z.string(), z.unknown()).nullable().optional(),
  changedFields: z.array(z.string().max(100)).max(100).optional(),

  performedBy:   performedBySchema.optional(),
  financialData: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata:      z.record(z.string(), z.unknown()).optional(),
  tags:          z.array(z.string().max(50)).max(50).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`audit-log:${ip}`, 240, 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;
  const { user } = result;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation error" }, { status: 422 });
  }

  const b = parsed.data;

  // Identity comes from the verified token. Only the display name is taken from
  // the body (it is not available in the token) and it is never authoritative.
  const performedBy = {
    uid:   user.uid,
    name:  b.performedBy?.name ?? user.email ?? "",
    email: user.email ?? "",
    role:  user.role,
  };

  const doc = {
    action:      b.action,
    category:    b.category,
    severity:    b.severity,
    source:      b.source ?? "dashboard",

    entityType:  b.entityType  ?? null,
    entityId:    b.entityId    ?? null,
    entityName:  b.entityName  ?? null,
    description: b.description ?? null,

    previousData:  b.previousData  ?? null,
    newData:       b.newData       ?? null,
    changedFields: b.changedFields ?? [],

    performedBy,
    financialData: b.financialData ?? null,
    metadata:      b.metadata ?? {},
    tags:          b.tags ?? [],

    status: "completed",

    // legacy mirror fields — kept so existing queries keep working
    actorUid:   performedBy.uid,
    actorName:  performedBy.name,
    actorRole:  performedBy.role,
    targetType: b.entityType ?? null,
    targetId:   b.entityId   ?? null,
    targetName: b.entityName ?? null,
    summary:    b.description ?? null,

    ipAddress: ip,
  };

  const token = getBearerToken(request)!;

  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("auditLogs").add({
        ...doc,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await fsAdd("auditLogs", { ...doc, createdAt: new Date().toISOString() }, token);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[audit-log]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
