import { NextResponse } from "next/server";
import { emailService } from "@/services/email.service";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";
import type { SendEmailRequest, EmailResult } from "@/types/email";

export const runtime = "nodejs";

/**
 * POST /api/send-email
 * Generic server-side email dispatch endpoint.
 * Called by alert engine or notification hooks to trigger specific email types.
 *
 * Body: SendEmailRequest { type, to, data }
 */
export async function POST(request: Request): Promise<NextResponse> {
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
  let body: SendEmailRequest;
  try {
    body = (await request.json()) as SendEmailRequest;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { type, to, data } = body;

  if (!type || !to || !data) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: type, to, data" },
      { status: 400 }
    );
  }

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
