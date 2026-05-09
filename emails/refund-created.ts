import type { RefundCreatedData } from "@/types/email";
import {
  baseLayout,
  emailHeading,
  emailInfoBox,
  emailAlertBox,
  emailButton,
  emailBodyText,
  escHtml,
} from "./base-layout";

export function refundCreatedTemplate(data: RefundCreatedData): string {
  const amountLabel = data.amountUSD
    ? `${data.amount.toLocaleString()} ${data.currency} (≈ $${data.amountUSD.toFixed(2)})`
    : `${data.amount.toLocaleString()} ${data.currency}`;

  const content = `
    ${emailHeading(
      "💸",
      "تم إنشاء طلب استرداد",
      `استرداد مالي لـ ${data.subscriberName}`
    )}

    ${emailAlertBox(
      `تم معالجة استرداد بمبلغ <strong>${amountLabel}</strong> من قِبل <strong>${escHtml(data.createdBy)}</strong>. يرجى المراجعة للتأكد من صحة العملية.`,
      "#D97706",
      "#FFFBEB",
      "#FDE68A"
    )}

    ${emailBodyText(
      `تم إنشاء طلب استرداد لمشترك <strong>${escHtml(data.subscriberName)}</strong>. فيما يلي تفاصيل الاسترداد:`
    )}

    ${emailInfoBox([
      { label: "المشترك",     value: `<strong>${escHtml(data.subscriberName)}</strong>` },
      { label: "المبلغ المسترد", value: `<strong style="color:#D97706;">${amountLabel}</strong>` },
      { label: "تاريخ الاسترداد", value: data.refundDate },
      { label: "بواسطة",      value: escHtml(data.createdBy) },
      ...(data.reason ? [{ label: "السبب", value: escHtml(data.reason) }] : []),
    ])}

    ${emailButton("مراجعة الاسترداد", data.dashboardUrl ?? "https://dashboard.example.com", "#D97706")}
  `;

  return baseLayout(
    {
      title:        "إشعار استرداد مالي",
      previewText:  `استرداد ${amountLabel} لـ ${data.subscriberName}`,
      accentColor:    "#D97706",
      accentColorEnd: "#F59E0B",
    },
    content
  );
}
