import "dotenv/config";
import { readFileSync } from "node:fs";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Fills in the swimmers from an export of the club's own system, matched on
 *  member number.
 *
 *      npx tsx scripts/update-students-from-export.ts --file "…/Enrolled Customer Data.csv" [--confirm]
 *
 *  Dry run without `--confirm`.
 *
 *  **The export is not committed and must not be.** It carries two thousand
 *  children's names, dates of birth, home emails and mobile numbers. It is
 *  passed by path and read at run time; nothing from it is written to this
 *  repository.
 *
 *  What it settles, which nothing else could:
 *
 *  - **Dates of birth.** Every swimmer in the app was imported from screens
 *    that showed a whole-year age and no birthday, so every one reads "—".
 *    This is the first source that has them, and they are worth more than the
 *    ages: a child turns six in the middle of a term.
 *  - **Names, but only their letters.** Every name in the app was read off a
 *    screenshot or a PDF by eye, so the export beats it — except on
 *    punctuation, where the export is plainly worse: it stores O'Sullivan as
 *    OSullivan and lowercases "Mc Cormack". See `letters` below.
 *
 *  Two kinds of change are reported separately on purpose. **Filled** is a
 *  blank field gaining a value, which is the point of the exercise. **Changed**
 *  is a value being replaced, which deserves a second look — a date of birth
 *  somebody typed in by hand is not obviously worse than one from an export,
 *  and this is where that would show up.
 *
 *  One audit row, not one per swimmer. The same granularity the roster imports
 *  used: this is a single act against a single source, and 1,100 rows would
 *  bury `/activity` rather than explain it. */

type Row = Record<string, string>;

/** RFC 4180 enough for this file: quoted fields, doubled quotes inside them,
 *  and no assumption that a comma is a separator until it is outside quotes. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  header[0] = header[0].replace(/^﻿/, "");
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}

/** "16/02/2009 00:00:00" — and one row reads 01:00:00, which is the same
 *  midnight seen through summer time. The clock part is dropped either way. */
function toIsoDate(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(dd)) return null;
  return iso;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message: string): never {
  console.error(`\nRefusing to run: ${message}`);
  process.exit(1);
}

/** Letters only, case folded, **accents kept**.
 *
 *  This is the whole of the name rule. The export is the club's own record and
 *  beats anything read off a screen — but only on letters. Its punctuation is
 *  visibly worse: it stores O'Sullivan as OSullivan, O'Hara as OHara, mixes
 *  straight and curly apostrophes, and lowercases "Mc Cormack". Taking it whole
 *  would strip the apostrophe from a hundred Irish surnames to fix seven names.
 *
 *  So: if two names match once punctuation and case are set aside, ours stands.
 *  If the letters themselves differ, the export wins. Accents count as letters,
 *  which is deliberate — Rian → Rían is the export knowing something we do not. */
function letters(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}]/gu, "");
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const file = arg("file");
  if (!file) fail('usage: --file "path/to/export.csv" [--confirm]');

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) fail("there is no active admin to attribute this to.");

  const rows = parseCsv(readFileSync(file, "utf8"));
  if (rows.length === 0) fail("that file has no rows.");

  const needed = ["Member Number", "First Name", "Last Name", "Email Address", "Mobile Telephone", "Date of Birth"];
  const missing = needed.filter((c) => !(c in rows[0]));
  if (missing.length) fail(`the export is missing ${missing.join(", ")}.`);

  // One row per (member, course), so a swimmer in two classes appears twice.
  // Collapse on the member number and refuse if their own rows disagree about
  // who they are — that would mean the export cannot be trusted to key on it.
  const people = new Map<string, { first: string; last: string; email: string; phone: string; dob: string }>();
  const disagreements: string[] = [];
  for (const r of rows) {
    const member = r["Member Number"].trim();
    if (!member) continue;
    const person = {
      first: r["First Name"].trim(),
      last: r["Last Name"].trim(),
      email: r["Email Address"].trim().toLowerCase(),
      phone: r["Mobile Telephone"].trim(),
      dob: r["Date of Birth"].trim(),
    };
    const seen = people.get(member);
    if (!seen) people.set(member, person);
    else if (JSON.stringify(seen) !== JSON.stringify(person)) {
      disagreements.push(`${member}: ${JSON.stringify(seen)} vs ${JSON.stringify(person)}`);
    }
  }
  if (disagreements.length) {
    console.log(`\nThe export disagrees with itself on ${disagreements.length} members:`);
    disagreements.slice(0, 10).forEach((d) => console.log(` ! ${d}`));
    fail("collapse those rows in the source before importing.");
  }

  console.log(`${rows.length} rows, ${people.size} distinct members in the export.`);

  const students = await prisma.student.findMany({
    where: { memberNumber: { not: null } },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      contactEmail: true,
      contactPhone: true,
    },
  });

  const filled = { dateOfBirth: 0, contactEmail: 0, contactPhone: 0, name: 0 };
  const changed: string[] = [];
  const renamed: string[] = [];
  const punctuationOnly: string[] = [];
  const badDates: string[] = [];
  const notInExport: string[] = [];
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let touched = 0;

  for (const s of students) {
    const person = people.get(s.memberNumber!);
    if (!person) {
      notInExport.push(`${s.firstName} ${s.lastName} (${s.memberNumber})`);
      continue;
    }

    const data: Prisma.StudentUpdateInput = {};
    const who = `${s.firstName} ${s.lastName} (${s.memberNumber})`;

    if (person.dob) {
      const iso = toIsoDate(person.dob);
      if (!iso) badDates.push(`${who}: "${person.dob}"`);
      else {
        const current = s.dateOfBirth?.toISOString().slice(0, 10) ?? null;
        if (current !== iso) {
          data.dateOfBirth = parseDateOnly(iso);
          if (current === null) filled.dateOfBirth += 1;
          else changed.push(`${who}: date of birth ${current} → ${iso}`);
        }
      }
    }

    if (person.email && person.email !== (s.contactEmail ?? "")) {
      data.contactEmail = person.email;
      if (!s.contactEmail) filled.contactEmail += 1;
      else changed.push(`${who}: contact email ${s.contactEmail} → ${person.email}`);
    }

    if (person.phone && person.phone !== (s.contactPhone ?? "")) {
      data.contactPhone = person.phone;
      if (!s.contactPhone) filled.contactPhone += 1;
      else changed.push(`${who}: contact phone ${s.contactPhone} → ${person.phone}`);
    }

    // First and last are judged separately, so a swimmer whose forename the
    // export knows better does not lose the apostrophe from their surname:
    // Rian O'Sullivan becomes Rían O'Sullivan, not Rían OSullivan.
    if (person.first && person.last) {
      const before = `${s.firstName} ${s.lastName}`;
      if (letters(s.firstName) !== letters(person.first)) data.firstName = person.first;
      if (letters(s.lastName) !== letters(person.last)) data.lastName = person.last;

      const after = `${data.firstName ?? s.firstName} ${data.lastName ?? s.lastName}`;
      if (after !== before) {
        filled.name += 1;
        renamed.push(`${s.memberNumber}: ${before} → ${after}`);
      } else if (`${person.first} ${person.last}` !== before) {
        punctuationOnly.push(`${s.memberNumber}: ${before} vs ${person.first} ${person.last}`);
      }
    }

    if (Object.keys(data).length > 0) {
      touched += 1;
      writes.push(prisma.student.update({ where: { id: s.id }, data }));
    }
  }

  console.log(`\n${students.length} swimmers in the app carry a member number.`);
  console.log(`${students.length - notInExport.length} of them are in the export, ${notInExport.length} are not.`);
  console.log(`${people.size - (students.length - notInExport.length)} members in the export are not in the app.`);
  console.log(`\n${touched} swimmers would be updated:`);
  console.log(`   dates of birth filled  ${filled.dateOfBirth}`);
  console.log(`   emails filled          ${filled.contactEmail}`);
  console.log(`   phones filled          ${filled.contactPhone}`);
  console.log(`   names corrected        ${filled.name}`);

  if (renamed.length) {
    console.log(`\nNames whose letters the export spells differently (${renamed.length}) — the export wins:`);
    renamed.forEach((r) => console.log(` - ${r}`));
  }
  if (punctuationOnly.length) {
    console.log(
      `\nSame letters, different punctuation or case (${punctuationOnly.length}) — ours kept, because the export drops apostrophes:`
    );
    punctuationOnly.slice(0, 12).forEach((p) => console.log(` - ${p}`));
    if (punctuationOnly.length > 12) console.log(`   …and ${punctuationOnly.length - 12} more`);
  }
  if (changed.length) {
    console.log(`\nExisting values replaced (${changed.length}) — worth a look, these were not blank:`);
    changed.forEach((c) => console.log(` ! ${c}`));
  }
  if (badDates.length) {
    console.log(`\nUnreadable dates of birth (${badDates.length}), left alone:`);
    badDates.forEach((d) => console.log(` - ${d}`));
  }
  if (notInExport.length) {
    console.log(`\nIn the app but not in the export (${notInExport.length}), left alone:`);
    notInExport.slice(0, 40).forEach((n) => console.log(` - ${n}`));
    if (notInExport.length > 40) console.log(`   …and ${notInExport.length - 40} more`);
  }

  if (!confirm) {
    console.log("\nDry run — nothing was written. Re-run with --confirm.");
    await prisma.$disconnect();
    return;
  }

  // Chunked so one statement per swimmer does not arrive as a single enormous
  // transaction on a pooled connection.
  const CHUNK = 100;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await prisma.$transaction(writes.slice(i, i + CHUNK));
    process.stdout.write(`\rwritten ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
  }
  console.log("");

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "update",
    entity: "Student",
    summary:
      `Filled in ${touched} swimmers from an export of the club's system, matched on member number — ` +
      `${filled.dateOfBirth} dates of birth, ${filled.contactEmail} emails and ${filled.contactPhone} phone numbers ` +
      `where there were none, ${filled.name} names corrected against the club's own spelling` +
      (changed.length ? `, and ${changed.length} existing values replaced` : "") +
      `.`,
  });

  console.log(`\nDone. ${touched} swimmers updated.`);
  await prisma.$disconnect();
}

void main();
