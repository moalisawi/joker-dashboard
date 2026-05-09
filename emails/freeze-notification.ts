import type { FreezeNotificationData } from "@/types/email";
import {
  baseLayout,
  emailHeading,
  emailInfoBox,
  emailButton,
  emailBodyText,
  emailBadge,
  escHtml,
} from "./base-layout";

export function freezeNotificationTemplate(data: FreezeNotificationData): string {
  const content = `
    ${emailHeading(
      "❄️",
      "تجميد اشتراك",
      `تم تجميد اشتراك ${data.subscriberName} مؤقتاً`
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td>
          ${emailBadge("مجمّد", "#2563EB", "#EFF6FF")}
        </td>
      </tr>
    </table>

    ${emailBodyText(
      `تم تجميد اشتراك <strong>${escHtml(data.subscriberName)}</strong> مؤقتاً. يوضح الجدول أدناه تفاصيل فترة التجميد:`
    )}

    ${emailInfoBox([
      { label: "المشترك",         value: `<strong>${escHtml(data.subscriberName)}</strong>` },
      { label: "بداية التجميد",    value: `<strong>${data.freezeStartDate}</strong>` },
      ...(data.freezeEndDate  ? [{ label: "نهاية التجميد",  value: data.freezeEndDate }]         : []),
      ...(data.processedBy    ? [{ label: "بواسطة",         value: escHtml(data.processedBy) }]   : []),
      ...(data.reason         ? [{ label: "السبب",          value: escHtml(data.reason) }]         : []),
    ])}

    ${emailBodyText(
      `سيتم استئناف الاشتراك تلقائياً عند انتهاء فترة التجميد${data.freezeEndDate ? ` في ${data.freezeEndDate}` : ""}.`
    )}

    ${emailButton("عرض المشترك", data.dashboardUrl ?? "https://dashboard.example.com", "#2563EB")}
  `;

  return baseLayout(
    {
      title:        "إشعار تجميد اشتراك",
      previewText:  `تجميد اشتراك ${data.subscriberName} من ${data.freezeStartDate}`,
      accentColor:    "#2563EB",
      accentColorEnd: "#3B82F6",
    },
    content
  );
}
