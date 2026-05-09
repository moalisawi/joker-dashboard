import type { WithdrawalNoticeData } from "@/types/email";
import {
  baseLayout,
  emailHeading,
  emailInfoBox,
  emailAlertBox,
  emailButton,
  emailBodyText,
  escHtml,
} from "./base-layout";

export function withdrawalNoticeTemplate(data: WithdrawalNoticeData): string {
  const content = `
    ${emailHeading(
      "🚪",
      "إشعار انسحاب مشترك",
      `تم تسجيل انسحاب ${data.subscriberName}`
    )}

    ${emailAlertBox(
      `انسحب المشترك <strong>${escHtml(data.subscriberName)}</strong> بتاريخ <strong>${data.withdrawalDate}</strong>. يرجى مراجعة السجلات للتوثيق.`,
      "#6B7280",
      "#F9FAFB",
      "#E5E7EB"
    )}

    ${emailBodyText(
      `تم تسجيل انسحاب المشترك <strong>${escHtml(data.subscriberName)}</strong> من الأكاديمية. فيما يلي تفاصيل العملية:`
    )}

    ${emailInfoBox([
      { label: "المشترك",       value: `<strong>${escHtml(data.subscriberName)}</strong>` },
      { label: "تاريخ الانسحاب",  value: `<strong>${data.withdrawalDate}</strong>` },
      ...(data.processedBy ? [{ label: "بواسطة", value: escHtml(data.processedBy) }] : []),
      ...(data.reason       ? [{ label: "السبب",  value: escHtml(data.reason) }]       : []),
    ])}

    ${emailButton("عرض التفاصيل", data.dashboardUrl ?? "https://dashboard.example.com", "#6B7280")}
  `;

  return baseLayout(
    {
      title:        "إشعار انسحاب مشترك",
      previewText:  `انسحاب ${data.subscriberName} — ${data.withdrawalDate}`,
      accentColor:    "#6B7280",
      accentColorEnd: "#9CA3AF",
    },
    content
  );
}
