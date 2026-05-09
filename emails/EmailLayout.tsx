import React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  title: string;
  gradient: string;
}

export function EmailLayout({ children, title, gradient }: EmailLayoutProps) {
  return (
    <html dir="rtl" lang="ar">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>{`
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: ${gradient};
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            color: #374151;
            line-height: 1.6;
          }
          .footer {
            background-color: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .cta-button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
          }
          .highlight {
            background-color: #dbeafe;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>{title}</h1>
          </div>
          <div className="content">
            {children}
          </div>
          <div className="footer">
            <p>هذا البريد الإلكتروني تم إرساله تلقائياً من نظام إدارة المشتركين - الجوكر</p>
          </div>
        </div>
      </body>
    </html>
  );
}