import { NextResponse }             from "next/server";
import { z }                        from "zod";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { requireAuth }              from "@/lib/requirePermission";
import { hasAdminCredentials, fsAdd } from "@/lib/serverFirestore";
import { getBearerToken }           from "@/lib/serverAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Server-side writer for the `notifications` collection.
 *
 * Why this route exists: firestore.rules allows `create` on notifications only
 * for staff (owner/admin). The client notification service called addDoc()
 * directly and swallowed the rejection with console.warn, so every notification
 * raised by an *employee* action was silently dropped — the people who most need
 * to be told an employee did something never were.
 *
 * Reads, markAsRead and archive stay on the client: the rules already permit
 * those for any active user.
 *
 * As with /api/audit-log, the performer is taken from the verified ID token so a
 * notification cannot be attributed to someone else.
 */

const bodySchema = z.object({
  type:          z.string().min(1).max(100),
  category:      z.string().min(1).max(50),
  severity:      z.string().min(1).max(30),
  title:         z.string().min(1).max(300),
  description:   z.string().max(1000),
  targetMinRole: z.enum(["owner", "admin", "employee"]),

  actionUrl:     z.string().max(500).optional(),
  entityType:    z.string().max(50).optional(),
  entityId:      z.string().max(200).optional(),
  entityName:    z.string().max(300).optional(),

  performedBy: z.object({
    uid:  z.string().max(128),
    name: z.string().max(200),
    role: z.string().max(50),
  }).optional(),

  financialData: z.object({
    amount:    z.number().optional(),
    currency:  z.string().max(10).optional(),
    amountUSD: z.number().optional(),
  }).nullable().optional(),

  metadata:      z.record(z.string(), z.unknown()).optional(),
  targetUserIds: z.array(z.string().max(128)).max(200).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`notif-create:${ip}`, 120, 60 * 1000))) {
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

  const performedBy = {
    uid:  user.uid,
    name: b.performedBy?.name ?? user.email ?? "",
    role: user.role,
  };

  const expiresAtMs = b.expiresInDays
    ? Date.now() + b.expiresInDays * 86_400_000
    : null;

  const doc = {
    type:          b.type,
    category:      b.category,
    severity:      b.severity,
    title:         b.title,
    description:   b.description,
    targetMinRole: b.targetMinRole,
    targetUserIds: b.targetUserIds ?? null,
    actionUrl:     b.actionUrl  ?? null,
    entityType:    b.entityType ?? null,
    entityId:      b.entityId   ?? null,
    entityName:    b.entityName ?? null,
    performedBy,
    financialData: b.financialData ?? null,
    metadata:      b.metadata ?? {},
    readBy:        [],
    archived:      false,
  };

  const token = getBearerToken(request)!;

  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("notifications").add({
        ...doc,
        expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await fsAdd("notifications", {
        ...doc,
        expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        createdAt: new Date().toISOString(),
      }, token);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notifications/create]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
