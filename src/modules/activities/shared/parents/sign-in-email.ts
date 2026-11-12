// Matches the approved LeisureWorld parent-app palette. Email clients need
// inline styles and literal colours rather than the app's CSS variables.
export const PARENT_EMAIL_LOGO_CID = "leisureworld-logo@turnfin";

export function parentSignInEmail(code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("A six-digit sign-in code is required.");
  return {
    subject: "Your LeisureWorld Aquatics parent sign-in code",
    text: `Your LeisureWorld Aquatics sign-in code is ${code}.\r\n\r\nIt expires in 10 minutes. Return to the page you were using and enter this code to continue.\r\n\r\nKeep this code private. Do not share it with anyone.\r\n\r\nIf you did not request it, you can ignore this email.\r\n\r\nSee you at the pool,\r\nThe LeisureWorld Aquatics team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Your LeisureWorld Aquatics sign-in code</title>
  <style>
    @media (max-width: 480px) {
      .email-outer { padding: 16px 12px !important; }
      .email-body { padding: 28px 24px !important; }
      .email-code { font-size: 36px !important; letter-spacing: 6px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-page, .email-card { background-color: #111827 !important; }
      .email-card { border-color: #475569 !important; }
      .email-heading, .email-copy { color: #E5F0F8 !important; }
      .email-muted { color: #D8E1E8 !important; }
      .email-code-panel { background-color: #07345E !important; }
      .email-code { color: #FFFFFF !important; }
      .email-rule { border-color: #475569 !important; }
    }
  </style>
  <!--[if mso]><style>body, table, td, h1, p { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body class="email-page" style="margin:0;padding:0;background-color:#F8FAFC;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your code is ready. Enter it in LeisureWorld Aquatics within 10 minutes.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-page" bgcolor="#F8FAFC" style="background-color:#F8FAFC;">
    <tr><td align="center" class="email-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" bgcolor="#FFFFFF" style="max-width:560px;background-color:#FFFFFF;border:1px solid #D8E1E8;border-radius:16px;">
        <tr><td align="center" bgcolor="#07345E" style="padding:24px;background-color:#07345E;border-radius:15px 15px 0 0;">
          <img src="cid:${PARENT_EMAIL_LOGO_CID}" width="144" height="72" alt="LeisureWorld" style="display:block;width:144px;height:72px;border:0;color:#FFFFFF;font-size:20px;">
          <p style="margin:8px 0 0;color:#FFFFFF;font-size:16px;line-height:24px;font-weight:600;">Aquatics</p>
        </td></tr>
        <tr><td class="email-body" style="padding:36px 40px;">
          <h1 class="email-heading" style="margin:0 0 16px;color:#0B4F8A;font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.5px;">Your sign-in code</h1>
          <p class="email-copy" style="margin:0 0 24px;color:#111827;font-size:16px;line-height:25px;">Welcome to LeisureWorld Aquatics. Return to the page you were using and enter this code to continue.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td align="center" class="email-code-panel" bgcolor="#E5F0F8" style="padding:20px 12px;background-color:#E5F0F8;border-radius:12px;">
              <p class="email-code" style="margin:0;color:#0B4F8A;font-size:44px;line-height:56px;font-weight:700;letter-spacing:8px;font-variant-numeric:tabular-nums;white-space:nowrap;">${code}</p>
            </td></tr>
          </table>
          <p class="email-muted" style="margin:12px 0 28px;color:#475569;text-align:center;font-size:14px;line-height:21px;">This code expires in <strong>10 minutes</strong>.</p>
          <p class="email-copy" style="margin:0;color:#111827;font-size:16px;line-height:25px;"><strong>Keep this code private.</strong><br>Do not share it with anyone.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td class="email-rule" style="padding-top:24px;"><div class="email-rule" style="border-top:1px solid #D8E1E8;font-size:1px;line-height:1px;">&nbsp;</div></td></tr>
          </table>
          <p class="email-muted" style="margin:20px 0;color:#475569;font-size:14px;line-height:22px;">If you didn’t request this code, you can safely ignore this email.</p>
          <p class="email-copy" style="margin:0;color:#111827;font-size:16px;line-height:25px;">See you at the pool,<br><strong>The LeisureWorld Aquatics team</strong></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p class="email-muted" style="margin:20px 0 0;color:#475569;font-size:14px;line-height:21px;">LeisureWorld Aquatics · Parent account</p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
