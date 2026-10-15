import { euro } from "@/modules/purchasing/shared/rules";

/** The approved purchase order as the supplier receives it by email (docs/purchasing.md):
 *  plain text and HTML with the same words. A test is the same email with one line on
 *  top saying who it would have gone to, and "Test" in the subject. Pure, so the preview
 *  page, the send and the tests all build exactly the same message. */

export type OrderEmailInput = {
  number: string;
  organisation: string;
  site: string;
  supplier: { name: string; contactName: string; email: string; accountNumber: string };
  neededBy: string | null;
  approvedOn: string | null;
  note: string;
  totalCents: number;
  lines: { name: string; code: string; unit: string; unitPriceCents: number; quantity: number }[];
  sender: { name: string; email: string };
};

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

/* Poolside Clear v2 hex values, copied from src/app/theme/poolside.css (mail clients
   cannot read CSS variables), as in the Academy and Turnfin Me emails. */
const INK = "color:#0f1b2d", MUTED = "color:#56627a", BODY = "font-size:14px;line-height:20px", RULE = "border-bottom:1px solid #e3e8ef";

export function orderEmail(o: OrderEmailInput, test = false) {
  const from = o.organisation || o.site;
  const deliverTo = [o.organisation, o.site].filter(Boolean).join(" ");
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
  const quote = `Please quote ${o.number} on your delivery note and invoice. Reply to this email with any questions; it goes to ${o.sender.name}.`;
  const banner = `Test email. This is exactly what ${o.supplier.name} will receive at ${o.supplier.email || "their email address (none saved yet)"}. It was sent only to you.`;
  const total = euro(o.totalCents);

  const text = [
    ...(test ? [banner, ""] : []),
    greeting, "", lead, "",
    ...facts.map(([k, v]) => `${k}: ${v}`), "",
    ...o.lines.map((l) => `${l.quantity} × ${l.name}${l.code ? ` (code ${l.code})` : ""}, ${l.unit || "each"}, at ${euro(l.unitPriceCents)}: ${euro(l.unitPriceCents * l.quantity)}`),
    "", `Total before VAT: ${total}`,
    ...(o.note ? ["", `Note: ${o.note}`] : []),
    "", quote, "", o.sender.name, from,
  ].join("\r\n");

  const cell = (v: string, right = false, strong = false) =>
    `<td style="padding:8px 6px;${RULE};${BODY};${strong ? INK : MUTED};${right ? "text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums" : "text-align:left"}">${escape(v)}</td>`;
  const head = (v: string, right = false) =>
    `<th style="padding:8px 6px;${RULE};font-size:12px;line-height:16px;font-weight:600;${MUTED};text-align:${right ? "right" : "left"}">${escape(v)}</th>`;
  const p = (v: string, style = "") => `<p style="margin:0 0 16px;${BODY};${INK};${style}">${escape(v)}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(subject)}</title>
<style>
@media (max-width: 480px) {
  .po-page { padding:8px 0 !important; }
  .po-panel { padding:20px 12px !important; }
  .po-lines td, .po-lines th { padding-left:3px !important; padding-right:3px !important; }
}
</style>
</head>
<body class="po-page" style="margin:0;padding:24px 16px;background-color:#eef2f6;font-family:'Plus Jakarta Sans',Arial,sans-serif;${INK};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef2f6"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#ffffff;border-radius:24px"><tr><td class="po-panel" style="padding:32px 24px;text-align:left">
${test ? `<p style="margin:0 0 24px;padding:12px 16px;border-radius:12px;background-color:#fff4d6;${BODY};color:#6b4a00">${escape(banner)}</p>` : ""}
<p style="margin:0 0 4px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;${MUTED}">${escape(from)}</p>
<p style="margin:0 0 24px;font-size:22px;line-height:28px;font-weight:700;${INK};font-variant-numeric:tabular-nums">Purchase order ${escape(o.number)}</p>
${p(greeting)}
${p(lead)}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
${facts.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;${BODY};${MUTED};white-space:nowrap">${escape(k)}</td><td style="padding:2px 0;${BODY};${INK};font-weight:600">${escape(v)}</td></tr>`).join("\n")}
</table>
<table class="po-lines" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;border-collapse:collapse">
<thead><tr>${head("Product")}${head("Code")}${head("Unit")}${head("Qty", true)}${head("Price", true)}${head("Line", true)}</tr></thead>
<tbody>
${o.lines.map((l) => `<tr>${cell(l.name, false, true)}${cell(l.code || "–")}${cell(l.unit || "Each")}${cell(String(l.quantity), true, true)}${cell(euro(l.unitPriceCents), true)}${cell(euro(l.unitPriceCents * l.quantity), true, true)}</tr>`).join("\n")}
</tbody>
<tfoot><tr><td colspan="5" style="padding:12px 6px 0;${BODY};${INK};font-weight:600;text-align:right">Total before VAT</td><td style="padding:12px 6px 0;font-size:16px;line-height:22px;${INK};font-weight:700;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums">${escape(total)}</td></tr></tfoot>
</table>
${o.note ? `<p style="margin:16px 0 4px;font-size:12px;line-height:16px;font-weight:600;${MUTED}">Note</p>${p(o.note, "white-space:pre-line")}` : ""}
<p style="margin:24px 0 16px;${BODY};${MUTED}">${escape(quote)}</p>
<p style="margin:0;${BODY};${INK}">${escape(o.sender.name)}<br>${escape(from)}</p>
</td></tr></table>
</td></tr></table>
</body>
</html>`;

  return { subject, text, html };
}
