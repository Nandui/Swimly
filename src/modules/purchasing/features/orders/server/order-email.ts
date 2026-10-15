/** The approved purchase order as the supplier receives it by email (docs/purchasing.md):
 *  plain text and HTML with the same words. No prices: the supplier invoices at the agreed
 *  prices, and the invoice goes to accounts (owner decision, 15 October 2026). A test is the same email with one line on
 *  top saying who it would have gone to, and "Test" in the subject. Pure, so the preview
 *  page, the send and the tests all build exactly the same message. */

import { lineDetails } from "@/modules/purchasing/shared/rules";

export type OrderEmailInput = {
  number: string;
  organisation: string;
  site: string;
  /** The site's postal address, one line per line; empty when Admin > Sites has none. */
  address: string;
  supplier: { name: string; contactName: string; email: string; accountNumber: string };
  neededBy: string | null;
  approvedOn: string | null;
  note: string;
  /** Brand, size and colour are empty for products without them. */
  lines: { name: string; code: string; unit: string; brand: string; size: string; colour: string; quantity: number }[];
  sender: { name: string; email: string };
  /** Who the supplier's replies go to: whoever raised the order. */
  replyTo: { name: string; email: string };
};

/** Where suppliers send invoices for every purchase order (owner decision, 15 October 2026). */
export const INVOICE_ADDRESS = "invoices@leisureworldcork.com";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

/** The LeisureWorld logo travels inside the email (assets/email, as in the parent emails),
 *  so mail clients show it without loading anything from the web. */
export const PO_EMAIL_LOGO_CID = "leisureworld-logo@turnfin";

/* Literal colours because mail clients cannot read CSS variables. The navy band and the
   white logo match the parent emails; the rest is Poolside Clear v2 (src/app/theme/poolside.css). */
const NAVY = "#07345E", INK = "color:#0f1b2d", MUTED = "color:#56627a", FAINT = "color:#8a94a6";
const FONT = "font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const BODY = "font-size:15px;line-height:24px", SMALL = "font-size:13px;line-height:20px";
const EYEBROW = "font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase";
const HAIRLINE = "border-top:1px solid #edf1f5";

/** `logoSrc` is the content ID by default; the preview page passes a web address instead,
 *  because a browser cannot resolve `cid:`. */
export function orderEmail(o: OrderEmailInput, test = false, logoSrc = `cid:${PO_EMAIL_LOGO_CID}`) {
  const from = o.organisation || o.site;
  // Site names often carry the organisation already ("LeisureWorld Churchfield").
  const place = o.organisation && !o.site.toLowerCase().includes(o.organisation.toLowerCase()) ? `${o.organisation} ${o.site}` : o.site;
  const addressLines = o.address.split("\n").map((l) => l.trim()).filter(Boolean);
  const deliverTo = [place, ...addressLines].join("\n");
  const subject = oneLine(`${test ? "Test: " : ""}Purchase order ${o.number} from ${from}`);
  const greeting = `Hello ${o.supplier.contactName || o.supplier.name},`;
  const lead = `Please supply the following against purchase order ${o.number}.`;
  const facts: [string, string][] = [
    ["Purchase order", o.number],
    ...(o.supplier.accountNumber ? [["Our account", o.supplier.accountNumber] as [string, string]] : []),
    ["Deliver to", deliverTo],
    ...(o.neededBy ? [["Needed by", o.neededBy] as [string, string]] : []),
    ...(o.approvedOn ? [["Approved", o.approvedOn] as [string, string]] : []),
  ];
  const invoices = `Please submit all invoices for this order to ${INVOICE_ADDRESS}, quoting ${o.number}.`;
  const quote = `Please quote ${o.number} on your delivery note. Reply to this email with any questions about the order; it goes to ${o.replyTo.name}.`;
  const banner = `Test email. This is exactly what ${o.supplier.name} will receive at ${o.supplier.email || "their email address (none saved yet)"}. It was sent only to you.`;
  const items = o.lines.reduce((n, l) => n + l.quantity, 0);
  const preheader = `${o.lines.length} ${o.lines.length === 1 ? "line" : "lines"}${o.neededBy ? `, needed by ${o.neededBy}` : ""}. Invoices to ${INVOICE_ADDRESS}.`;

  const text = [
    ...(test ? [banner, ""] : []),
    greeting, "", lead, "",
    ...facts.map(([k, v]) => `${k}: ${v.replace(/\n/g, ", ")}`), "",
    ...o.lines.map((l) => `${l.quantity} × ${l.name}${lineDetails(l) ? `, ${lineDetails(l)}` : ""}${l.code ? ` (code ${l.code})` : ""}, ${l.unit || "each"}`),
    ...(o.note ? ["", `Note: ${o.note}`] : []),
    "", `INVOICES: ${invoices}`,
    "", quote, "", o.sender.name, from,
  ].join("\r\n");

  // The facts after the order number, which already heads the email.
  const fact = ([k, v]: [string, string], first: boolean) =>
    `<tr><td class="po-fact-k" style="padding:12px 16px 12px 0;${first ? "" : HAIRLINE + ";"}${SMALL};${MUTED};white-space:nowrap;vertical-align:top;width:120px">${escape(k)}</td>` +
    `<td class="po-fact-v" style="padding:12px 0;${first ? "" : HAIRLINE + ";"}${BODY};${INK};font-weight:600;vertical-align:top">${v.split("\n").map(escape).join("<br>")}</td></tr>`;
  const line = (l: OrderEmailInput["lines"][number], i: number) => {
    const meta = [lineDetails(l), l.code ? `Code ${l.code}` : ""].filter(Boolean).join(" · ");
    return `<tr><td style="padding:16px 12px 16px 0;${i ? HAIRLINE + ";" : ""}vertical-align:top">` +
      `<p style="margin:0;${BODY};${INK};font-weight:600">${escape(l.name)}</p>` +
      (meta ? `<p style="margin:2px 0 0;${SMALL};${MUTED}">${escape(meta)}</p>` : "") + `</td>` +
      `<td align="right" style="padding:16px 0;${i ? HAIRLINE + ";" : ""}vertical-align:top;white-space:nowrap">` +
      `<span style="display:inline-block;min-width:24px;padding:4px 12px;border-radius:999px;background-color:#eef3fb;color:${NAVY};font-size:15px;line-height:22px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums">${l.quantity}${l.unit ? ` <span style="font-weight:500">× ${escape(l.unit)}</span>` : ""}</span></td></tr>`;
  };
  const p = (v: string, style = "") => `<p style="margin:0 0 16px;${BODY};${INK};${style}">${escape(v)}</p>`;
  const eyebrow = (v: string, colour = FAINT) => `<p style="margin:0 0 8px;${EYEBROW};${colour}">${escape(v)}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(subject)}</title>
<style>
@media (max-width: 520px) {
  .po-outer { padding:12px 8px !important; }
  .po-band { padding:28px 20px 24px !important; }
  .po-body { padding:28px 20px 8px !important; }
  .po-foot { padding:0 20px 28px !important; }
  .po-fact-k, .po-fact-v { display:block !important; width:auto !important; }
  .po-fact-k { padding:12px 0 0 !important; }
  .po-fact-v { padding:2px 0 12px !important; border-top:0 !important; }
  .po-number { font-size:28px !important; line-height:34px !important; }
}
</style>
<!--[if mso]><style>body, table, td, p, a, span { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;${FONT};${INK};-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escape(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef2f6" style="background-color:#eef2f6"><tr><td align="center" class="po-outer" style="padding:40px 16px">
<!--[if mso]><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
${test ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 0 12px"><tr><td style="padding:14px 18px;border-radius:16px;background-color:#fff4d6;border:1px solid #f3dc9b;${SMALL};color:#6b4a00;text-align:left"><strong>Test email.</strong> ${escape(banner.replace(/^Test email\. /, ""))}</td></tr></table>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e2e8f0" style="max-width:640px;background-color:#e2e8f0;border-radius:30px"><tr><td style="padding:6px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:24px">
<tr><td class="po-band" align="left" bgcolor="${NAVY}" style="padding:32px 40px 28px;background-color:${NAVY};border-radius:24px 24px 0 0">
<img src="${escape(logoSrc)}" width="120" height="60" alt="LeisureWorld" style="display:block;width:120px;height:60px;border:0;color:#ffffff;font-size:18px;font-weight:700">
<p style="margin:28px 0 6px;${EYEBROW};color:#9fc1e3">Purchase order${from ? ` · ${escape(from)}` : ""}</p>
<p class="po-number" style="margin:0;font-size:34px;line-height:40px;font-weight:700;letter-spacing:-0.01em;color:#ffffff">${escape(o.number)}</p>
<p style="margin:10px 0 0;${SMALL};color:#c9dbee">${o.lines.length} ${o.lines.length === 1 ? "line" : "lines"}, ${items} ${items === 1 ? "item" : "items"}${o.neededBy ? ` · Needed by ${escape(o.neededBy)}` : ""}</p>
</td></tr>
<tr><td class="po-body" style="padding:36px 40px 8px;text-align:left">
${p(greeting)}
${p(lead, "margin-bottom:28px")}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f8fb" style="background-color:#f6f8fb;border-radius:18px;margin:0 0 32px"><tr><td style="padding:8px 20px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
${facts.slice(1).map((f, i) => fact(f, i === 0)).join("\n")}
</table>
</td></tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="left">${eyebrow("What we need")}</td><td align="right">${eyebrow("Qty")}</td></tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;border-top:2px solid #0f1b2d;border-bottom:1px solid #edf1f5">
${o.lines.map(line).join("\n")}
</table>
${o.note ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr><td style="padding:2px 0 2px 16px;border-left:3px solid ${NAVY}">${eyebrow("Note")}${p(o.note, "margin:0;white-space:pre-line")}</td></tr></table>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 28px"><tr><td bgcolor="#e8f0fe" style="padding:20px 22px;border-radius:18px;background-color:#e8f0fe;border:1px solid #b9cdf7">
${eyebrow("Invoices", "color:#1a4fbf")}
<p style="margin:0;${BODY};${INK}">Please submit all invoices for this order to <a href="mailto:${INVOICE_ADDRESS}" style="color:#1a4fbf;font-weight:700;text-decoration:underline">${INVOICE_ADDRESS}</a>, quoting <strong>${escape(o.number)}</strong>.</p>
</td></tr></table>
${p(quote, `${MUTED}`)}
</td></tr>
<tr><td class="po-foot" style="padding:0 40px 36px;text-align:left">
<p style="margin:0;padding-top:20px;${HAIRLINE};${BODY};${INK}"><strong>${escape(o.sender.name)}</strong><br><span style="${MUTED}">${escape(from)}</span></p>
</td></tr>
</table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:20px 0 0;${SMALL};${FAINT};text-align:center">Purchase order ${escape(o.number)} · ${escape(place)}</p>
</td></tr></table>
</body>
</html>`;

  return { subject, text, html };
}
