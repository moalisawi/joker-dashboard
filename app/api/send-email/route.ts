import { NextResponse } from "next/server";
import { z } from "zod";
import { emailService } from "@/services/email.service";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { SendEmailRequest, EmailResult } from "@/types/email";

export const runtime = "nodejs";

/**
 * Body schema.
 *
 * `to` is the field that matters most: without validation any string reached
 * the mail provider, so a malformed or attacker-supplied value could be used to
 * send mail to arbitrary addresses. Recipients are capped so this endpoint
 * cannot be turned into a bulk mailer.
 *
 * `data` stays a loose object on purpose — each email type has its own shape and
 * the service layer already narrows it. Validating the union here would add
 * eight schemas that must be kept in sync with types/email.ts for no security
 * gain.
 */
const emailAddress = z.string().trim().email().max(254);

const bodySchema = z.object({
  type: z.enum([
    "subscription_expiring",
    "renewal_success",
    "refund_created",
    "withdrawal_notice",
    "freeze_notification",
    "security_alert",
    "failed_login",
    "account_suspended",
  ]),
  to: z.union([emailAddress, z.array(emailAddress).min(1).max(50)]),
  data: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/send-email
 * Generic server-side email dispatch endpoint.
 * Called by alert engine or notification hooks to trigger specific email types.
 *
 * Body: SendEmailRequest { type, to, data }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit: 20 emails per IP per hour
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`send-email:${ip}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  let currentUser;
  try {
    currentUser = await verifyServerUser(request);
  } catch (err) {
    console.error("[send-email] Auth verification failed:", err);
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!hasServerPermission(currentUser, "settings", "manage")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  // ── Config check ────────────────────────────────────────────────────────────
  const config = emailService.validateConfig();
  if (!config.valid) {
    console.error("[send-email] Config invalid:", config.error);
    return NextResponse.json(
      { success: false, error: config.error },
      { status: 500 }
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation error" },
      { status: 422 }
    );
  }

  const { type, to } = parsed.data;

  // The schema guarantees `data` is an object; its per-email-type shape is
  // narrowed by the switch below. Going through `unknown` is deliberate — a
  // direct cast from Record<string, unknown> to the union is not a valid
  // narrowing, and the previous code reached the same place implicitly by
  // casting the raw `any` from request.json().
  const data = parsed.data.data as unknown as SendEmailRequest["data"];

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  let result: EmailResult;

  try {
    switch (type) {
      case "subscription_expiring":
        result = await emailService.sendSubscriptionExpiringEmail(
          to,
          data as Parameters<typeof emailService.sendSubscriptionExpiringEmail>[1]
        );
        break;

      case "renewal_success":
        result = await emailService.sendRenewalSuccessEmail(
          to,
          data as Parameters<typeof emailService.sendRenewalSuccessEmail>[1]
        );
        break;

      case "refund_created":
        result = await emailService.sendRefundCreatedEmail(
          to,
          data as Parameters<typeof emailService.sendRefundCreatedEmail>[1]
        );
        break;

      case "withdrawal_notice":
        result = await emailService.sendWithdrawalNoticeEmail(
          to,
          data as Parameters<typeof emailService.sendWithdrawalNoticeEmail>[1]
        );
        break;

      case "freeze_notification":
        result = await emailService.sendFreezeNotificationEmail(
          to,
          data as Parameters<typeof emailService.sendFreezeNotificationEmail>[1]
        );
        break;

      case "security_alert":
        result = await emailService.sendSecurityAlertEmail(
          to,
          data as Parameters<typeof emailService.sendSecurityAlertEmail>[1]
        );
        break;

      case "failed_login":
        result = await emailService.sendFailedLoginAlertEmail(
          to,
          data as Parameters<typeof emailService.sendFailedLoginAlertEmail>[1]
        );
        break;

      case "account_suspended":
        result = await emailService.sendAccountSuspendedEmail(
          to,
          data as Parameters<typeof emailService.sendAccountSuspendedEmail>[1]
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown email type: ${type}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-email] Dispatch error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }

  if (!result.success) {
    console.error("[send-email] Failed:", result.error);
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success:   true,
    messageId: result.messageId,
    type,
  });
}
