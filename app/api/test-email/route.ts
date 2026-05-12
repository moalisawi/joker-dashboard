import { NextResponse } from "next/server";
import { emailService } from "@/services/email.service";
import { hasServerPermission, verifyServerUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

/**
 * GET /api/test-email
 * Sends a real test email using Resend and returns JSON.
 *
 * Query params:
 *   to    — recipient address  (default: zoromedo2000@gmail.com)
 *   type  — email type to preview (default: security_alert)
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Test email endpoint is disabled in production" },
      { status: 404 }
    );
  }

  let currentUser;
  try {
    currentUser = await verifyServerUser(request);
  } catch (err) {
    console.error("[test-email] Auth verification failed:", err);
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
    return NextResponse.json(
      { success: false, error: config.error },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const to   = searchParams.get("to")   ?? "zoromedo2000@gmail.com";
  const type = searchParams.get("type") ?? "security_alert";

  const now = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

  let result;

  switch (type) {
    case "subscription_expiring":
      result = await emailService.sendSubscriptionExpiringEmail(to, {
        subscriberName: "أحمد محمد",
        expiryDate:     "2026-05-12",
        daysLeft:       3,
        planName:       "الباقة الذهبية",
        dashboardUrl:   "https://dashboard.example.com",
      });
      break;

    case "renewal_success":
      result = await emailService.sendRenewalSuccessEmail(to, {
        subscriberName: "سارة علي",
        renewalDate:    now,
        newExpiryDate:  "2026-06-09",
        amount:         150,
        currency:       "SAR",
        amountUSD:      40,
        processedBy:    "محمد (مدير)",
        dashboardUrl:   "https://dashboard.example.com",
      });
      break;

    case "refund_created":
      result = await emailService.sendRefundCreatedEmail(to, {
        subscriberName: "خالد إبراهيم",
        amount:         200,
        currency:       "SAR",
        amountUSD:      53.3,
        reason:         "طلب المشترك إلغاء الاشتراك",
        createdBy:      "ريم (موظفة)",
        refundDate:     now,
        dashboardUrl:   "https://dashboard.example.com",
      });
      break;

    case "withdrawal_notice":
      result = await emailService.sendWithdrawalNoticeEmail(to, {
        subscriberName:  "نورة سعد",
        withdrawalDate:  now,
        reason:         "انتقال إلى مدينة أخرى",
        processedBy:    "محمد (مدير)",
        dashboardUrl:   "https://dashboard.example.com",
      });
      break;

    case "freeze_notification":
      result = await emailService.sendFreezeNotificationEmail(to, {
        subscriberName:  "فيصل عمر",
        freezeStartDate: now,
        freezeEndDate:   "2026-06-01",
        reason:          "سفر خارج المملكة",
        processedBy:     "محمد (مدير)",
        dashboardUrl:    "https://dashboard.example.com",
      });
      break;

    case "failed_login":
      result = await emailService.sendFailedLoginAlertEmail(to, {
        count:         7,
        targetEmail:   "admin@joker.sa",
        detectedAt:    now,
        windowMinutes: 30,
        dashboardUrl:  "https://dashboard.example.com",
      });
      break;

    case "account_suspended":
      result = await emailService.sendAccountSuspendedEmail(to, {
        userName:    "ريم الأحمد",
        userEmail:   "reem@joker.sa",
        userRole:    "employee",
        suspendedBy: "محمد (مالك)",
        reason:      "انتهاك سياسة الاستخدام",
        suspendedAt: now,
        dashboardUrl: "https://dashboard.example.com",
      });
      break;

    default: // security_alert
      result = await emailService.sendSecurityAlertEmail(to, {
        alertType:      "نشاط استرداد غير مألوف",
        description:    "تم رصد 6 استردادات بإجمالي 780 USD من موظف واحد خلال 24 ساعة.",
        detectedAt:     now,
        severity:       "critical",
        affectedEntity: "ريم الأحمد (موظفة)",
        dashboardUrl:   "https://dashboard.example.com",
      });
  }

  if (result.success) {
    return NextResponse.json({
      success:   true,
      messageId: result.messageId,
      sentTo:    to,
      type,
      message:   `Test email (${type}) sent successfully to ${to}`,
    });
  }

  return NextResponse.json(
    { success: false, error: result.error, sentTo: to, type },
    { status: 500 }
  );
}
