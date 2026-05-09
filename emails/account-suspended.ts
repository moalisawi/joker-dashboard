import type { AccountSuspendedData } from "@/types/email";
import {
  baseLayout,
  emailHeading,
  emailInfoBox,
  emailAlertBox,
  emailButton,
  emailBodyText,
  emailBadge,
  escHtml,
} from "./base-layout";

export function accountSuspendedTemplate(data: AccountSuspendedData): string {
  const content = `
    ${emailHeading(
      "🔒",
      "تم تعليق حساب مستخدم",
      `تعليق حساب ${data.userName} في لوحة التحكم`
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td>
          ${emailBadge("معلّق", "#DC2626", "#FEF2F2")}
          &nbsp;
          ${emailBadge("أمني", "#7C3AED", "#F5F3FF")}
          ${data.userRole ? `&nbsp;${emailBadge(data.userRole, "#6B7280", "#F9FAFB")}` : ""}
        </td>
      </tr>
    </table>

    ${emailAlertBox(
      `تم تعليق حساب <strong>${escHtml(data.userName)}</strong> (${escHtml(data.userEmail)}) بواسطة <strong>${escHtml(data.suspendedBy)}</strong>. الحساب محجوب حتى إشعار آخر.`,
      "#DC2626",
      "#FEF2F2",
      "#FECACA"
    )}

    ${emailBodyText(
      `يُرجى مراجعة سجلات التدقيق للاطلاع على السياق الكامل لهذا الإجراء. إذا تمّ التعليق بالخطأ، يمكن رفعه من لوحة إدارة المستخدمين.`
    )}

    ${emailInfoBox([
      { label: "المستخدم",      value: `<strong>${escHtml(data.userName)}</strong>` },
      { label: "البريد",         value: `<code style="font-family:monospace;background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:13px;">${escHtml(data.userEmail)}</code>` },
      ...(data.userRole ? [{ label: "الدور", value: emailBadge(data.userRole, "#6B7280", "#F9FAFB") }] : []),
      { label: "تاريخ التعليق",  value: `<strong>${data.suspendedAt}</strong>` },
      { label: "بواسطة",        value: escHtml(data.suspendedBy) },
      ...(data.reason ? [{ label: "السبب", value: escHtml(data.reason) }] : []),
    ])}

    ${emailButton("إدارة المستخدمين", data.dashboardUrl ?? "https://dashboard.example.com", "#DC2626")}
  `;

  return baseLayout(
    {
      title:        "تعليق حساب مستخدم",
      previewText:  `تم تعليق حساب ${data.userName} (${data.userEmail})`,
      accentColor:    "#DC2626",
      accentColorEnd: "#7C3AED",
    },
    content
  );
}
