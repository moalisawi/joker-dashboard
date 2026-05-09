/**
 * Email Service — server-side only.
 * Import this file exclusively from API routes or server actions.
 * Never import from client components or client-side services.
 */

import { Resend } from "resend";
import type {
  EmailResult,
  SendEmailPayload,
  SubscriptionExpiringData,
  RenewalSuccessData,
  RefundCreatedData,
  WithdrawalNoticeData,
  FreezeNotificationData,
  SecurityAlertData,
  FailedLoginData,
  AccountSuspendedData,
} from "@/types/email";

import { subscriptionExpiringTemplate } from "@/emails/subscription-expiring";
import { renewalSuccessTemplate }       from "@/emails/renewal-success";
import { refundCreatedTemplate }        from "@/emails/refund-created";
import { withdrawalNoticeTemplate }     from "@/emails/withdrawal-notice";
import { freezeNotificationTemplate }   from "@/emails/freeze-notification";
import { securityAlertTemplate }        from "@/emails/security-alert";
import { failedLoginTemplate }          from "@/emails/failed-login";
import { accountSuspendedTemplate }     from "@/emails/account-suspended";

// ─── Resend client (lazy — only instantiated on first call) ───────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[email] RESEND_API_KEY is not set. Add it to .env.local."
      );
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Joker Dashboard <onboarding@resend.dev>";

// ─── Base send ────────────────────────────────────────────────────────────────

async function sendEmail(payload: SendEmailPayload): Promise<EmailResult> {
  try {
    const resend = getResend();

    const sendOptions: Parameters<typeof resend.emails.send>[0] = {
      from:    FROM,
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
    };

    if (payload.replyTo) {
      sendOptions.reply_to = payload.replyTo;
    }
    if (payload.tags) {
      sendOptions.tags = payload.tags;
    }

    const { data, error } = await resend.emails.send(sendOptions);

    if (error) {
      console.error("[email] Resend API error:", error);
      return { success: false, error: error.message };
    }

    const messageId = (data as { id?: string } | null)?.id;
    console.info("[email] Sent successfully — id:", messageId);
    return { success: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendEmail failed:", message);
    return { success: false, error: message };
  }
}

// ─── Typed send helpers ───────────────────────────────────────────────────────

async function sendSubscriptionExpiringEmail(
  to: string | string[],
  data: SubscriptionExpiringData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `⏰ تنبيه: اشتراك ${data.subscriberName} ينتهي خلال ${data.daysLeft} ${data.daysLeft === 1 ? "يوم" : "أيام"}`,
    html:    subscriptionExpiringTemplate(data),
    tags:    [{ name: "type", value: "subscription_expiring" }],
  });
}

async function sendRenewalSuccessEmail(
  to: string | string[],
  data: RenewalSuccessData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `✅ تم تجديد اشتراك ${data.subscriberName} بنجاح`,
    html:    renewalSuccessTemplate(data),
    tags:    [{ name: "type", value: "renewal_success" }],
  });
}

async function sendRefundCreatedEmail(
  to: string | string[],
  data: RefundCreatedData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `💸 استرداد مالي لـ ${data.subscriberName} — ${data.amount.toLocaleString()} ${data.currency}`,
    html:    refundCreatedTemplate(data),
    tags:    [{ name: "type", value: "refund_created" }],
  });
}

async function sendWithdrawalNoticeEmail(
  to: string | string[],
  data: WithdrawalNoticeData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `🚪 إشعار انسحاب: ${data.subscriberName}`,
    html:    withdrawalNoticeTemplate(data),
    tags:    [{ name: "type", value: "withdrawal_notice" }],
  });
}

async function sendFreezeNotificationEmail(
  to: string | string[],
  data: FreezeNotificationData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `❄️ تجميد اشتراك: ${data.subscriberName}`,
    html:    freezeNotificationTemplate(data),
    tags:    [{ name: "type", value: "freeze_notification" }],
  });
}

async function sendSecurityAlertEmail(
  to: string | string[],
  data: SecurityAlertData
): Promise<EmailResult> {
  const prefix = data.severity === "critical" ? "🚨 حرج" : "⚠️ تحذير";
  return sendEmail({
    to,
    subject: `${prefix}: تنبيه أمني — ${data.alertType}`,
    html:    securityAlertTemplate(data),
    tags:    [
      { name: "type",     value: "security_alert" },
      { name: "severity", value: data.severity },
    ],
  });
}

async function sendFailedLoginAlertEmail(
  to: string | string[],
  data: FailedLoginData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `🔐 تنبيه: ${data.count} محاولات دخول فاشلة${data.targetEmail ? ` على ${data.targetEmail}` : ""}`,
    html:    failedLoginTemplate(data),
    tags:    [{ name: "type", value: "failed_login" }],
  });
}

async function sendAccountSuspendedEmail(
  to: string | string[],
  data: AccountSuspendedData
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `🔒 تعليق حساب: ${data.userName} (${data.userEmail})`,
    html:    accountSuspendedTemplate(data),
    tags:    [{ name: "type", value: "account_suspended" }],
  });
}

// ─── Config validation ────────────────────────────────────────────────────────

function validateConfig(): { valid: boolean; error?: string } {
  if (!process.env.RESEND_API_KEY) {
    return { valid: false, error: "RESEND_API_KEY is not set" };
  }
  return { valid: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const emailService = {
  sendEmail,
  validateConfig,

  sendSubscriptionExpiringEmail,
  sendRenewalSuccessEmail,
  sendRefundCreatedEmail,
  sendWithdrawalNoticeEmail,
  sendFreezeNotificationEmail,
  sendSecurityAlertEmail,
  sendFailedLoginAlertEmail,
  sendAccountSuspendedEmail,
};
