import { z } from "zod";
import { CONTACT_METHODS, CONTACT_RESULTS, OPEN_STATUSES, OUTCOMES, type Outcome, type PaymentStatus } from "./types";

/** Payments' rules, pure (tested in rules.test.ts). */

/** A problem a person can fix by changing what they entered or uploaded; shown beside the form. */
export class PaymentError extends Error {}

// ---------------------------------------------------------------------------
// The failure sheet
// ---------------------------------------------------------------------------

/** One failed direct debit as the bank's sheet has it. */
export type SheetRow = {
  /** The row on its sheet, counting the heading as 1, for messages. */
  line: number; sheet: string;
  club: string; name: string; amountCents: number; reference: string;
  /** 1 for the first row with this reference and amount, 2 for the next: the same reference can
   *  fail twice in a month, and a sheet uploaded twice must match its rows again. */
  copy: number;
  returnCode: string; returnReason: string; memberNumber: string;
};

/** The columns Turnfin reads, by their heading on the sheet. Others are ignored. */
const COLUMNS = {
  club: "club name", name: "contact name", amount: "amount", reference: "reference",
  returnCode: "return code", returnReason: "return description", memberNumber: "membership number", message: "message",
} as const;
/** The bank's sheet has Club Name, Amount and Reference. The short sheet (owner, 3 November 2026,
 *  "Failed DDs Oct.xlsx") has only Contact Name, Amount, Return Description and Membership Number,
 *  a tab per site: its tab is the club, its member number the reference, and its return code is
 *  read from the description. */
const FORMATS = [["club", "amount", "reference"], ["amount", "memberNumber"]] as const;

/** The return code a description means, for a sheet without the Return Code column: the bank's
 *  words for its codes, without case, spaces or punctuation. Others stay without a code. */
const CODE_FOR_REASON: Record<string, string> = {
  insufficientfunds: "AM04", nomandate: "MD01", accountblocked: "AC06", accountclosed: "AC04",
  transactionforbidden: "AG01", byorderofthebeneficiaryreasonnotspecified: "MS02", unspecifiedreason: "MS03",
};
const reasonKey = (reason: string) => reason.toLowerCase().replace(/[^a-z]/g, "");

const cell = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
const heading = (value: unknown) => cell(value).toLowerCase().replace(/\s+/g, " ");

/** The failed debits on every sheet of the workbook, every row kept: each tab lists different
 *  debits. A sheet without either format's headings is skipped (a notes tab); rows without a
 *  reference (on the short sheet, a member number) are the totals under the list and are skipped
 *  too. */
export function parseFailureSheets(sheets: { sheet: string; data: unknown[][] }[]): SheetRow[] {
  const out: SheetRow[] = [];
  const copies = new Map<string, number>();
  let found = false;
  for (const { sheet, data } of sheets) {
    const head = data.findIndex((row) => FORMATS.some((format) => format.every((k) => row.some((c) => heading(c) === COLUMNS[k]))));
    if (head < 0) continue;
    found = true;
    const at = Object.fromEntries(Object.entries(COLUMNS).map(([k, label]) => [k, data[head].findIndex((c) => heading(c) === label)])) as Record<keyof typeof COLUMNS, number>;
    const get = (row: unknown[], k: keyof typeof COLUMNS) => (at[k] < 0 ? "" : cell(row[at[k]]));
    for (let i = head + 1; i < data.length; i++) {
      const row = data[i];
      const memberNumber = get(row, "memberNumber").replace(/\s+/g, "").toUpperCase();
      const reference = at.reference < 0 ? memberNumber : get(row, "reference");
      const club = at.club < 0 ? sheet : get(row, "club");
      if (!reference || !club) continue;
      const amount = Number(get(row, "amount").replace(/[€,\s]/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) throw new PaymentError(`Row ${i + 1} on ${sheet} (${reference}) has no amount. Check the sheet and upload it again.`);
      const message = get(row, "message");
      const reason = get(row, "returnReason");
      const amountCents = Math.round(amount * 100);
      const copy = (copies.get(`${reference}|${amountCents}`) ?? 0) + 1;
      copies.set(`${reference}|${amountCents}`, copy);
      out.push({
        line: i + 1, sheet, club, name: get(row, "name") || "Name not given", amountCents, reference, copy,
        returnCode: at.returnCode < 0 ? CODE_FOR_REASON[reasonKey(reason)] ?? "" : get(row, "returnCode").toUpperCase(),
        returnReason: [reason, message && message !== reason ? message : ""].filter(Boolean).join(". "), memberNumber,
      });
    }
  }
  if (!found) throw new PaymentError("This doesn't look like the failure sheet: no tab has the Club Name, Amount and Reference columns, or Amount and Membership Number.");
  return out;
}

const siteWords = (name: string) => name.toLowerCase().replace(/leisure\s*world/g, "").replace(/\blw\b/g, "").replace(/[^a-z]/g, "");

/** Clubs the bank names differently from the site (owner, 2 November 2026): its "LW Douglas" is
 *  the Gus Healy Swimming Pool. Each is the bank's words and the words of the site's name, both
 *  without "LW", spaces or punctuation. */
const CLUB_ALIASES: Record<string, string> = { douglas: "gushealy" };

/** The site a sheet's club name means: "LW Churchfield" is Churchfield. The site's name without
 *  "LW" or "LeisureWorld", in either direction, or its short code; a club the bank names
 *  differently goes by its alias ("LW Douglas" is Gus Healy). Null when none or two match. */
export function siteForClub<S extends { id: string; name: string; code?: string | null }>(club: string, sites: readonly S[]): S | null {
  const words = siteWords(club);
  if (!words) return null;
  const code = club.trim().toUpperCase();
  const alias = CLUB_ALIASES[words];
  const aliased = alias ? sites.filter((s) => siteWords(s.name).includes(alias)) : [];
  if (aliased.length === 1) return aliased[0];
  const matches = sites.filter((s) => {
    const own = siteWords(s.name);
    return (own && (own === words || words.includes(own) || own.includes(words))) || (!!s.code && s.code.toUpperCase() === code);
  });
  return matches.length === 1 ? matches[0] : null;
}

/** What makes two uploads the same sheet, whatever month they were given: its debits (reference,
 *  amount and copy), in order. Uploading it again under another month would add every row twice. */
export function sheetFingerprintSource(rows: readonly Pick<SheetRow, "reference" | "amountCents" | "copy">[]) {
  return rows.map((r) => `${r.reference}|${r.amountCents}|${r.copy}`).sort().join("\n");
}

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The collection month a file's name suggests, "Failed Lessons 09.xlsx" in November 2026 being
 *  September 2026: the last number from 1 to 12, in this year unless that month is still to come.
 *  A browser's copy number, "Failed Lessons 09 (1).xlsx", is not a month. Empty when the name has
 *  none. */
export function monthFromFileName(fileName: string, todayIso: string): string {
  const name = fileName.replace(/\.[a-z]+$/i, "").replace(/\s*\(\d+\)\s*$/, "");
  const numbers = [...name.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n >= 1 && n <= 12);
  const month = numbers.at(-1);
  if (!month) return "";
  const [year, current] = [Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7))];
  return `${month > current ? year - 1 : year}-${String(month).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Following a failure up
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
const step = { id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive() };

export const contactSchema = z.object({
  ...step,
  method: z.enum(CONTACT_METHODS, { error: "Choose how you contacted them." }),
  result: z.enum(CONTACT_RESULTS, { error: "Choose what happened." }),
  note: text(1000).default(""),
});
export type ContactInput = z.input<typeof contactSchema>;

export const closeSchema = z.object({ ...step, outcome: z.enum(OUTCOMES, { error: "Choose how it ended." }), note: text(1000).default("") });
export type CloseInput = z.input<typeof closeSchema>;

export const reopenSchema = z.object({ ...step, note: text(1000).min(3, "Say why it is open again.") });
export type ReopenInput = z.input<typeof reopenSchema>;

export const isOpen = (status: string): status is (typeof OPEN_STATUSES)[number] => (OPEN_STATUSES as readonly string[]).includes(status);

type Who = { id: string; name: string };
/** A contact: counted, and the failure waits on the member. Once closed it takes no more. */
export function contactChange(status: PaymentStatus, now: Date) {
  if (!isOpen(status)) throw new PaymentError("This payment is already closed. Refresh to see how it ended.");
  return { status: "contacted" as const, attempts: { increment: 1 }, lastContactAt: now };
}

/** How it ended: paid, a new mandate, or the place cancelled. A cancelled place needs a reason. */
export function closeChange(status: PaymentStatus, outcome: Outcome, note: string, who: Who, now: Date) {
  if (!isOpen(status)) throw new PaymentError("This payment is already closed. Refresh to see how it ended.");
  if (outcome === "cancelled" && note.length < 3) throw new PaymentError("Say why the place was cancelled, such as ‘left at the end of term’.");
  return { status: outcome, outcome: note, closedAt: now, closedById: who.id, closedByName: who.name };
}

/** Open it again (it was closed by mistake, or the new mandate failed too): back to contacted when
 *  anyone has been in touch, else to contact. */
export function reopenChange(status: PaymentStatus, attempts: number) {
  if (isOpen(status)) throw new PaymentError("This payment is still open.");
  return { status: attempts > 0 ? "contacted" as const : "to_contact" as const, outcome: "", closedAt: null, closedById: null, closedByName: null };
}

/** The first problem in what was sent, in the person's words. */
export function problemOf(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the details and try again.";
}
