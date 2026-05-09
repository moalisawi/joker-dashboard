import type { RenewalSuccessData } from "@/types/email";
import {
  baseLayout,
  emailHeading,
  emailInfoBox,
  emailButton,
  emailBodyText,
  emailBadge,
  escHtml,
} from "./base-layout";

export function renewalSuccessTemplate(data: RenewalSuccessData): string {
  const amountLabel = data.amountUSD
    ? `${data.amount.toLocaleString()} ${data.currency} (≈ $${data.amountUSD.toFixed(2)})`
    : `${data.amount.toLocaleString()} ${data.currency}`;

  const content = `
    ${emailHeading(
      "✅",
      "تم تجديد الاشتراك بنجاح",
      `تم تجديد اشتراك ${data.subscriberName} وتحديث تاريخ الانتهاء`
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td>
          ${emailBadge("تجديد ناجح", "#059669", "#ECFDF5")}
        </td>
      </tr>
    </table>

    ${emailBodyText(
      `تم تجديد اشتراك <strong>${escHtml(data.subscriberName)}</strong> بنجاح. فيما يلي تفاصيل العملية:`
    )}

    ${emailInfoBox([
      { label: "المشترك",          value: `<strong>${escHtml(data.subscriberName)}</strong>` },
      { label: "تاريخ التجديد",     value: data.renewalDate },
      { label: "تاريخ الانتهاء الجديد", value: `<strong style="color:#059669;">${data.newExpiryDate}</strong>` },
      { label: "المبلغ",            value: `<strong>${amountLabel}</strong>` },
      ...(data.processedBy ? [{ label: "بواسطة", value: data.processedBy }] : []),
    ])}

    ${emailButton("عرض تفاصيل التجديد", data.dashboardUrl ?? "https://dashboard.example.com", "#059669")}
  `;

  return baseLayout(
    {
      title:        "تجديد اشتراك ناجح",
      previewText:  `تم تجديد اشتراك ${data.subscriberName} بمبلغ ${amountLabel}`,
      accentColor:    "#059669",
      accentColorEnd: "#10B981",
    },
    content
  );
}
