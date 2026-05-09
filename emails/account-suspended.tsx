import React from 'react';
import { EmailLayout } from './EmailLayout';

interface AccountSuspendedEmailProps {
  userName: string;
  reason: string;
  suspendedUntil?: string;
}

export function AccountSuspendedEmail({
  userName,
  reason,
  suspendedUntil
}: AccountSuspendedEmailProps) {
  return (
    <EmailLayout title="إشعار تعليق حساب" gradient="linear-gradient(135deg, #6b7280 0%, #4b5563 100%)">
      <p>مرحباً،</p>
      <div style={{
        backgroundColor: '#f3f4f6',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        padding: '20px',
        margin: '20px 0'
      }}>
        <p><strong>تم تعليق حساب {userName}</strong></p>
        <p>السبب: {reason}</p>
        {suspendedUntil && <p>تاريخ إعادة التفعيل: {suspendedUntil}</p>}
      </div>
      <p>للمزيد من المعلومات، يرجى التواصل مع الإدارة.</p>
    </EmailLayout>
  );
}