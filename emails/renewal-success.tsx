import React from 'react';
import { EmailLayout } from './EmailLayout';

interface RenewalSuccessEmailProps {
  subscriberName: string;
  amount: number;
  currency: string;
  renewedUntil: string;
}

export function RenewalSuccessEmail({
  subscriberName,
  amount,
  currency,
  renewedUntil
}: RenewalSuccessEmailProps) {
  return (
    <EmailLayout title="تم التجديد بنجاح" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)">
      <p>مرحباً،</p>
      <div style={{
        backgroundColor: '#d1fae5',
        border: '1px solid #10b981',
        borderRadius: '6px',
        padding: '20px',
        margin: '20px 0'
      }}>
        <p><strong>تم تجديد اشتراك {subscriberName} بنجاح</strong></p>
        <p>المبلغ المدفوع: <span style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#059669'
        }}>{amount} {currency}</span></p>
        <p>صالح حتى: {renewedUntil}</p>
      </div>
      <p>شكراً لاستمرارك معنا!</p>
    </EmailLayout>
  );
}