import type { SecurityAlertData } from "@/types/email";
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

export function securityAlertTemplate(data: SecurityAlertData): string {
  const isCritical = data.severity === "critical";
  const color      = isCritical ? "#DC2626" : "#D97706";
  const bgColor    = isCritical ? "#FEF2F2" : "#FFFBEB";
  const border     = isCritical ? "#FECACA" : "#FDE68A";
  const label      = isCritical ? "حرج" : "تحذير";

  const content = `
    ${emailHeading(
      isCritical ? "🚨" : "⚠️",
      `تنبيه أمني — ${escHtml(data.alertType)}`,
      "تم رصد نشاط يستدعي المراجعة الفورية"
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td>
          ${emailBadge(label, color, bgColor)}
          &nbsp;
          ${emailBadge("أمني", "#7C3AED", "#F5F3FF")}
        </td>
      </tr>
    </table>

    ${emailAlertBox(
      `<strong>${escHtml(data.description)}</strong>`,
      color,
      bgColor,
      border
    )}

    ${emailBodyText(
      `تم رصد تنبيه أمني في لوحة التحكم. يرجى مراجعة التفاصيل أدناه واتخاذ الإجراء المناسب فوراً.`
    )}

    ${emailInfoBox([
      { label: "نوع التنبيه",   value: `<strong>${escHtml(data.alertType)}</strong>` },
      { label: "الخطورة",       value: emailBadge(label, color, bgColor) },
      { label: "وقت الرصد",     value: `<strong>${data.detectedAt}</strong>` },
      ...(data.affectedEntity ? [{ label: "الكيان المتأثر", value: escHtml(data.affectedEntity) }] : []),
      ...(data.ipAddress      ? [{ label: "عنوان IP",       value: `<code style="font-family:monospace;background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:13px;">${escHtml(data.ipAddress)}</code>` }] : []),
    ])}

    ${emailButton("مراجعة السجلات", data.dashboardUrl ?? "https://dashboard.example.com", color)}
  `;

  return baseLayout(
    {
      title:        `تنبيه أمني — ${data.alertType}`,
      previewText:  `تنبيه أمني: ${data.description}`,
      accentColor:    color,
      accentColorEnd: isCritical ? "#EF4444" : "#F59E0B",
    },
    content
  );
}
