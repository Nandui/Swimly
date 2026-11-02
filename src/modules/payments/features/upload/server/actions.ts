"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { liveSitesOf } from "@/lib/directory";
import { formatDate } from "@/lib/format";
import { today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { readWorkbook } from "@/lib/xlsx";
import { members, type MemberHit } from "@/modules/contributions";
import { covers, requirePaymentsActor, type PaymentsActor } from "@/modules/payments/shared/access";
import { MONTH, monthFromFileName, parseFailureSheets, PaymentError, sheetFingerprintSource, siteForClub, type SheetRow } from "@/modules/payments/shared/rules";
import { failureLabel } from "@/modules/payments/shared/service";
import { euro, monthLabel, PAYMENT_ACTIONS } from "@/modules/payments/shared/types";

/** The monthly failure sheet (owner, 2 November 2026): the bank's list of direct debits that
 *  failed, one tab per site. A count first, which writes nothing; then the upload, which reads the
 *  file again and adds each debit not already in for that month, at the sites where this person
 *  holds `payments.manage`. Only debits whose member number belongs to a swimmer on Turnfin are
 *  tracked (owner, 2 November 2026); the rest (gym memberships, unknown numbers) are counted and
 *  left out. A club matching no site is left out and named; the rest are added.
 *  The same sheet uploaded again is refused, whatever month it is given, and within a month a
 *  debit already in is never added twice. */

const MAX_BYTES = 10 * 1024 * 1024;

export type SheetPreview = {
  fileName: string; month: string; monthLabel: string;
  /** Debits on the sheet; those new for the month at the person's sites; those already in. */
  rows: number; added: number; already: number; addedCents: number;
  /** Debits whose member number belongs to no swimmer on Turnfin: never tracked. */
  notSwimmers: number;
  bySite: { name: string; added: number; cents: string }[];
  /** Club names that match no site, with their debits: those are left out and the rest are added.
   *  Once the site exists, uploading the sheet again adds only them. */
  unknownClubs: { club: string; rows: number; cents: string }[];
  /** Debits at sites this person does not manage, left for someone who does. */
  elsewhere: number;
  /** When this exact sheet was uploaded before, under any month: it is refused, so nothing is added twice. */
  uploadedBefore: string | null;
};

const fingerprintOf = (rows: SheetRow[]) => createHash("sha256").update(sheetFingerprintSource(rows)).digest("hex");

/** The earlier upload of this exact sheet, in words: "uploaded for September 2026 by Maya on 2 Nov
 *  2026". Null when it is new. */
async function uploadedBefore(orgId: string | null, rows: SheetRow[]) {
  const earlier = await prisma.paymentImport.findFirst({ where: { orgId: orgId ?? "", fingerprint: fingerprintOf(rows) }, orderBy: { createdAt: "asc" },
    select: { month: true, uploadedByName: true, createdAt: true } });
  return earlier ? `uploaded for ${monthLabel(earlier.month)} by ${earlier.uploadedByName} on ${formatDate(earlier.createdAt)}` : null;
}

async function readSheet(formData: FormData): Promise<{ ok: true; fileName: string; month: string; rows: SheetRow[] } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the failure sheet (.xlsx)." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Upload the failure sheet as an Excel file (.xlsx)." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than a failure sheet should be (10 MB)." };
  const month = String(formData.get("month") ?? "") || monthFromFileName(file.name, today());
  if (!MONTH.test(month)) return { ok: false, error: "Choose the month these direct debits were collected." };
  if (month > today().slice(0, 7)) return { ok: false, error: "That month has not happened yet. Choose the month the debits were collected." };
  try {
    const rows = parseFailureSheets((await readWorkbook(file)) as { sheet: string; data: unknown[][] }[]);
    if (!rows.length) return { ok: false, error: "No failed debits were found on that sheet." };
    return { ok: true, fileName: file.name, month, rows };
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, error: error.message };
    return { ok: false, error: "That file could not be read. Save it again as .xlsx and upload it." };
  }
}

/** A debit within its month: the same reference can fail twice, for different amounts. */
const debitKey = (d: { reference: string; amountCents: number; copy: number }) => `${d.reference}|${d.amountCents}|${d.copy}`;

/** Which debits go where: only those whose member number belongs to a swimmer (when the swim
 *  school is on, else none), then each one's site, whether this person manages it and whether it
 *  is already in for the month. */
async function plan(who: PaymentsActor, month: string, all: SheetRow[]) {
  const [sites, manage, existing, directory] = await Promise.all([
    liveSitesOf(who.orgId), sitesFor("payments.manage"),
    prisma.paymentFailure.findMany({ where: { orgId: who.orgId ?? "", month, reference: { in: all.map((r) => r.reference) } }, select: { reference: true, amountCents: true, copy: true } }),
    members(),
  ]);
  const swimmers = directory ? await directory.byNumbers(all.map((r) => r.memberNumber).filter(Boolean)) : new Map<string, MemberHit>();
  const rows = all.filter((r) => swimmers.has(r.memberNumber));
  const have = new Set(existing.map(debitKey));
  const placed = rows.map((row) => ({ row, site: siteForClub(row.club, sites) }));
  const unknown = new Map<string, { rows: number; cents: number }>();
  for (const { row, site } of placed) {
    if (site) continue;
    const u = unknown.get(row.club) ?? { rows: 0, cents: 0 };
    unknown.set(row.club, { rows: u.rows + 1, cents: u.cents + row.amountCents });
  }
  const unplaced = placed.length - placed.filter((p) => p.site).length;
  const mine = placed.filter((p) => p.site && covers(manage, p.site.id));
  const fresh = mine.filter((p) => !have.has(debitKey(p.row))) as { row: SheetRow; site: { id: string; name: string } }[];
  return {
    swimSchoolOff: !directory, notSwimmers: all.length - rows.length,
    unknown: [...unknown].sort(([a], [b]) => a.localeCompare(b)).map(([club, u]) => ({ club, ...u })),
    elsewhere: placed.length - unplaced - mine.length, already: mine.length - fresh.length, fresh, swimmers,
  };
}

export async function previewFailureSheet(formData: FormData): Promise<{ ok: true; preview: SheetPreview } | { ok: false; error: string }> {
  const who = await requirePaymentsActor();
  if (!who.manage) return { ok: false, error: "Uploading the failure sheet needs Payments: Manage." };
  const read = await readSheet(formData);
  if (!read.ok) return read;
  const [p, before] = await Promise.all([plan(who, read.month, read.rows), uploadedBefore(who.orgId, read.rows)]);
  const bySite = new Map<string, { name: string; added: number; cents: number }>();
  for (const { row, site } of p.fresh) {
    const s = bySite.get(site.id) ?? { name: site.name, added: 0, cents: 0 };
    bySite.set(site.id, { ...s, added: s.added + 1, cents: s.cents + row.amountCents });
  }
  return { ok: true, preview: {
    fileName: read.fileName, month: read.month, monthLabel: monthLabel(read.month),
    rows: read.rows.length, added: p.fresh.length, already: p.already, addedCents: p.fresh.reduce((t, f) => t + f.row.amountCents, 0),
    notSwimmers: p.notSwimmers,
    bySite: [...bySite.values()].map((s) => ({ name: s.name, added: s.added, cents: euro(s.cents) })),
    unknownClubs: p.unknown.map((u) => ({ club: u.club, rows: u.rows, cents: euro(u.cents) })), elsewhere: p.elsewhere, uploadedBefore: before,
  } };
}

export async function uploadFailureSheet(formData: FormData): Promise<{ ok: true; added: number; month: string } | { ok: false; error: string }> {
  const who = await requirePaymentsActor();
  if (!who.manage) return { ok: false, error: "Uploading the failure sheet needs Payments: Manage." };
  const read = await readSheet(formData);
  if (!read.ok) return read;
  const operationId = String(formData.get("operationId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(operationId)) return { ok: false, error: "Refresh the page and upload the sheet again." };
  if (!who.orgId) return { ok: false, error: "Your account belongs to no organisation." };
  const orgId = who.orgId;
  // The same press twice (a retry) saves once: the import's id is the form's operation.
  const done = await prisma.paymentImport.findUnique({ where: { id: operationId }, select: { added: true, month: true, uploadedById: true } });
  if (done) return done.uploadedById === who.id ? { ok: true, added: done.added, month: done.month } : { ok: false, error: "Refresh the page and upload the sheet again." };
  const before = await uploadedBefore(orgId, read.rows);
  if (before) return { ok: false, error: `This sheet was already ${before}, so nothing was added again.` };
  const p = await plan(who, read.month, read.rows);
  if (!p.fresh.length) return { ok: false, error: p.swimSchoolOff ? "Swimmers can’t be matched while the Swim school app is switched off, so nothing was added."
    : p.already ? "Every swimmer’s debit on this sheet is already in for that month."
    : p.notSwimmers === read.rows.length ? "None of the member numbers on this sheet belong to a swimmer on Turnfin, so there is nothing to add."
    : p.unknown.length ? `No site matches ${p.unknown.map((u) => u.club).join(", ")}, so nothing could be added. Check the site names in Admin › Sites.`
    : "None of these debits are at a site you manage." };
  const added = await prisma.$transaction(async (tx) => {
    // Only debits still not in: anything another upload added since the count is left as it is.
    const since = new Set((await tx.paymentFailure.findMany({ where: { orgId, month: read.month, reference: { in: p.fresh.map((f) => f.row.reference) } }, select: { reference: true, amountCents: true, copy: true } })).map(debitKey));
    const rows = p.fresh.filter((f) => !since.has(debitKey(f.row)));
    await tx.paymentImport.create({ data: {
      id: operationId, orgId, month: read.month, fileName: read.fileName.slice(0, 200), rows: read.rows.length, added: rows.length, fingerprint: fingerprintOf(read.rows),
      totalCents: rows.reduce((t, f) => t + f.row.amountCents, 0), uploadedById: who.id, uploadedByName: who.name,
    } });
    for (const { row, site } of rows) {
      const failure = await tx.paymentFailure.create({ data: {
        orgId, siteId: site.id, importId: operationId, month: read.month, reference: row.reference.slice(0, 80), copy: row.copy,
        memberNumber: row.memberNumber.slice(0, 40), memberId: p.swimmers.get(row.memberNumber)?.id ?? null,
        name: row.name.slice(0, 160), amountCents: row.amountCents, returnCode: row.returnCode.slice(0, 10), returnReason: row.returnReason.slice(0, 300),
      } });
      await tx.paymentFailureEvent.create({ data: { orgId, failureId: failure.id, operationId, actorId: who.id, actorName: who.name, action: "import", note: read.fileName.slice(0, 200) } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "import", entity: "PaymentFailure", entityId: failure.id, clubId: site.id,
        summary: `${failureLabel(failure)}. ${PAYMENT_ACTIONS.import} ${read.fileName}`.slice(0, 1000) }, tx);
    }
    return rows.length;
  }, { timeout: 120_000 });
  revalidatePath("/payments", "layout");
  revalidatePath("/students/[id]", "page");
  return { ok: true, added, month: read.month };
}
