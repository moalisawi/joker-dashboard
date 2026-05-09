import React from 'react';
import { EmailLayout } from './EmailLayout';

interface SubscriptionExpiringEmailProps {
  subscriberName: string;
  expiryDate: string;
  daysLeft: number;
}

export function SubscriptionExpiringEmail({
  subscriberName,
  expiryDate,
  daysLeft
}: SubscriptionExpiringEmailProps) {
  return (
    <EmailLayout title="تنبيه اشتراك" gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
      <p>مرحباً،</p>
      <div style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        padding: '20px',
        margin: '20px 0'
      }}>
        <p><strong>ينتهي اشتراك {subscriberName} خلال {daysLeft} أيام</strong></p>
        <p>تاريخ الانتهاء: <span className="highlight">{expiryDate}</span></p>
      </div>
      <p>يرجى التواصل مع المشترك لتجديد الاشتراك قبل انتهائه لتجنب أي انقطاع في الخدمة.</p>
      <a href="#" className="cta-button">عرض تفاصيل المشترك</a>
    </EmailLayout>
  );
}