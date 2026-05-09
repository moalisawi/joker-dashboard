// ─── Shared email layout helpers ──────────────────────────────────────────────
// All functions return inline-CSS HTML strings — safe for all major email clients.

export interface BaseLayoutOptions {
  title: string;
  previewText?: string;
  accentColor?: string;
  accentColorEnd?: string;
}

// Main layout wrapper
export function baseLayout(options: BaseLayoutOptions, content: string): string {
  const accent    = options.accentColor    ?? "#7C3AED";
  const accentEnd = options.accentColorEnd ?? "#4F46E5";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>${escHtml(options.title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;direction:rtl;-webkit-font-smoothing:antialiased;">
  ${options.previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F4F4F5;">${escHtml(options.previewText)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F5;min-width:100%;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-size:22px;font-weight:800;color:#18181B;letter-spacing:-1px;text-decoration:none;">
                &#9889; Joker Dashboard
              </span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);">

              <!-- Accent gradient bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:5px;background:linear-gradient(90deg,${accent} 0%,${accentEnd} 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:40px 40px 36px;">
                    ${content}
                  </td>
                </tr>
              </table>

              <!-- Footer divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 40px;">
                    <div style="height:1px;background-color:#F3F4F6;font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>
              </table>

              <!-- Footer text -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:20px 40px;">
                    <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6;direction:rtl;">
                      Joker Dashboard &middot; إشعار تلقائي &middot; يرجى عدم الرد على هذا البريد
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Bottom gap -->
          <tr><td style="height:32px;font-size:0;line-height:0;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Reusable content components ──────────────────────────────────────────────

export function emailHeading(icon: string, title: string, subtitle?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td>
        <p style="margin:0 0 10px 0;font-size:36px;line-height:1;">${icon}</p>
        <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;letter-spacing:-0.5px;">${escHtml(title)}</h1>
        ${subtitle ? `<p style="margin:0;font-size:14px;color:#6B7280;line-height:1.5;">${escHtml(subtitle)}</p>` : ""}
      </td>
    </tr>
  </table>`;
}

export function emailInfoBox(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      (r) => `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #F9FAFB;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:12px;color:#9CA3AF;font-weight:500;width:40%;vertical-align:top;padding-left:8px;">${escHtml(r.label)}</td>
              <td style="font-size:14px;color:#111827;font-weight:600;vertical-align:top;">${r.value}</td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9FAFB;border-radius:10px;overflow:hidden;margin-bottom:28px;">
    ${cells}
  </table>`;
}

export function emailAlertBox(message: string, color: string, bgColor: string, borderColor: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td style="background-color:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:${color};line-height:1.6;font-weight:500;">${message}</p>
      </td>
    </tr>
  </table>`;
}

export function emailButton(label: string, url: string, color = "#7C3AED"): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="border-radius:8px;background-color:${color};">
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:12px 28px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:0.1px;">
          ${escHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export function emailBadge(text: string, color: string, bgColor: string): string {
  return `<span style="display:inline-block;padding:3px 10px;background-color:${bgColor};color:${color};border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;">${escHtml(text)}</span>`;
}

export function emailDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="height:1px;background-color:#F3F4F6;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

export function emailBodyText(text: string): string {
  return `<p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.7;">${text}</p>`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
