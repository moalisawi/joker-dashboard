import React from 'react';
import { EmailLayout } from './EmailLayout';

interface SecurityAlertEmailProps {
  alertType: string;
  details: string;
  timestamp: string;
}

export function SecurityAlertEmail({
  alertType,
  details,
  timestamp
}: SecurityAlertEmailProps) {
  return (
    <EmailLayout title="تنبيه أمني" gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)">
      <p>مرحباً،</p>
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #ef4444',
        borderRadius: '6px',
        padding: '20px',
        margin: '20px 0'
      }}>
        <p><strong>{alertType}</strong></p>
        <p>{details}</p>
        <p>الوقت: {timestamp}</p>
      </div>
      <p>يرجى مراجعة السجلات والتحقق من الأمان فوراً.</p>
      <a href="#" style={{
        display: 'inline-block',
        backgroundColor: '#ef4444',
        color: 'white',
        padding: '12px 24px',
        textDecoration: 'none',
        borderRadius: '6px',
        fontWeight: '500',
        margin: '20px 0'
      }}>عرض السجلات</a>
    </EmailLayout>
  );
}