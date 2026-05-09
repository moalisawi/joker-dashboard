import type { SubscriptionExpiringData } from "@/types/email";
import {
  baseLayout,
  emailHeading,
  emailInfoBox,
  emailAlertBox,
  emailButton,
  emailBodyText,
  emailBadge,
} from "./base-layout";

export function subscriptionExpiringTemplate(data: SubscriptionExpiringData): string {
  const urgencyColor   = data.daysLeft <= 1 ? "#DC2626" : data.daysLeft <= 2 ? "#D97706" : "#7C3AED";
  const urgencyBg      = data.daysLeft <= 1 ? "#FEF2F2" : data.daysLeft <= 2 ? "#FFFBEB" : "#F5F3FF";
  const urgencyBorder  = data.daysLeft <= 1 ? "#FECACA" : data.daysLeft <= 2 ? "#FDE68A" : "#DDD6FE";
  const urgencyLabel   = data.daysLeft <= 1 ? "عاجل جداً" : data.daysLeft <= 2 ? "عاجل" : "تنبيه";

  const content = `
    ${emailHeading(
      "⏰",
      "اشتراك على وشك الانتهاء",
      `متبقي ${data.daysLeft} ${data.daysLeft === 1 ? "يوم" : "أيام"} على انتهاء الاشتراك`
    )}

    ${emailAlertBox(
      `${emailBadge(urgencyLabel, urgencyColor, urgencyBg)} &nbsp; اشتراك <strong>${data.subscriberName}</strong> ينتهي في <strong>${data.expiryDate}</strong>`,
      urgencyColor,
      urgencyBg,
      urgencyBorder
    )}

    ${emailBodyText(
      `يُرجى التواصل مع المشترك وإجراء التجديد في أقرب وقت ممكن لتجنب انقطاع الخدمة.`
    )}

    ${emailInfoBox([
      { label: "المشترك",       value: `<strong>${data.subscriberName}</strong>` },
      { label: "تاريخ الانتهاء", value: `<strong style="color:${urgencyColor};">${data.expiryDate}</strong>` },
      { label: "الأيام المتبقية", value: `<strong>${data.daysLeft} ${data.daysLeft === 1 ? "يوم" : "أيام"}</strong>` },
      ...(data.planName ? [{ label: "الباقة", value: data.planName }] : []),
    ])}

    ${emailButton("عرض المشترك", data.dashboardUrl ?? "https://dashboard.example.com", urgencyColor)}
  `;

  return baseLayout(
    {
      title:        "اشتراك على وشك الانتهاء",
      previewText:  `${data.subscriberName} — متبقي ${data.daysLeft} يوم على انتهاء الاشتراك`,
      accentColor:    urgencyColor,
      accentColorEnd: urgencyColor,
    },
    content
  );
}
