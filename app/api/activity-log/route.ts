import { NextResponse }            from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireAuth }              from "@/lib/requirePermission";
import { hasAdminCredentials, fsAdd } from "@/lib/serverFirestore";
import { getBearerToken }            from "@/lib/serverAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { z }                         from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  type:        z.string().min(1).max(100),
  employeeId:  z.string().optional().nullable(),
  employeeName:z.string().max(200).optional().nullable(),
  teamId:      z.string().optional().nullable(),
  teamName:    z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  metadata:    z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`activity-log:${ip}`, 120, 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;
  const { user } = result;

  if (!hasAdminCredentials()) {
    return NextResponse.json({ success: false, skipped: true }, { status: 202 });
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation error" }, { status: 422 });
  }

  const token = getBearerToken(request)!;
  const doc = {
    ...parsed.data,
    actorUid:  user.uid,
    actorRole: user.role,
  };

  try {
    if (hasAdminCredentials()) {
      await getFirestore().collection("activityLogs").add({
        ...doc,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await fsAdd("activityLogs", { ...doc, createdAt: new Date().toISOString() }, token);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[activity-log]", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
