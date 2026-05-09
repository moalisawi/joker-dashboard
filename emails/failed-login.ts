import type { FailedLoginData } from "@/types/email";
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

export function failedLoginTemplate(data: FailedLoginData): string {
  const window = data.windowMinutes ?? 60;

  const content = `
    ${emailHeading(
      "🔐",
      "محاولات دخول فاشلة متعددة",
      `تم رصد ${data.count} محاولات فاشلة خلال ${window} دقيقة`
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td>
          ${emailBadge("حرج", "#DC2626", "#FEF2F2")}
          &nbsp;
          ${emailBadge("أمني", "#7C3AED", "#F5F3FF")}
        </td>
      </tr>
    </table>

    ${emailAlertBox(
      `تم رصد <strong>${data.count} محاولة دخول فاشلة</strong>${data.targetEmail ? ` على حساب <strong>${escHtml(data.targetEmail)}</strong>` : ""} خلال الـ ${window} دقيقة الماضية. هذا يشير إلى محاولة اختراق محتملة.`,
      "#DC2626",
      "#FEF2F2",
      "#FECACA"
    )}

    ${emailBodyText(
      `إذا لم تتعرف على هذا النشاط، يُرجى مراجعة سجلات الدخول فوراً واتخاذ الإجراء المناسب.`
    )}

    ${emailInfoBox([
      { label: "عدد المحاولات",    value: `<strong style="color:#DC2626;">${data.count}</strong>` },
      ...(data.targetEmail ? [{ label: "الحساب المستهدف", value: `<code style="font-family:monospace;background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:13px;">${escHtml(data.targetEmail)}</code>` }] : []),
      { label: "وقت الرصد",       value: `<strong>${data.detectedAt}</strong>` },
      { label: "نافذة الزمن",     value: `خلال ${window} دقيقة` },
    ])}

    ${emailButton("مراجعة سجلات الدخول", data.dashboardUrl ?? "https://dashboard.example.com", "#DC2626")}
  `;

  return baseLayout(
    {
      title:        "تنبيه: محاولات دخول فاشلة",
      previewText:  `رصد ${data.count} محاولات دخول فاشلة${data.targetEmail ? ` على ${data.targetEmail}` : ""}`,
      accentColor:    "#DC2626",
      accentColorEnd: "#EF4444",
    },
    content
  );
}
