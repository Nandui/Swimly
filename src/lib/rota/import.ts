"use server";

import { revalidatePath } from "next/cache";
import { readWorkbook } from "@/lib/xlsx";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { requireRotaActor } from "@/lib/rota/access";
import { addDaysIso } from "@/lib/rota/constants";
import { rosterDepartment, siteForPlace } from "@/lib/rota/departments";
import { diffRoster, parseRoster, RosterError, sameName, type ParsedRoster, type RosterChange, type RosterEntry } from "@/lib/rota/roster";

/** Uploading the week's roster (docs/rota.md). A preview first, which writes
 *  nothing; then the import, which reads the file again rather than trusting
 *  the preview. Each department code's site comes from the payroll system's
 *  code list (departments.ts); days at places that are not Turnfin sites are
 *  left out and counted. Needs `rota.manage` at every site the file's
 *  departments reach. A later upload of the same week replaces that week's imported entries
 *  and records what moved; shifts added by hand are never touched. */

const MAX_BYTES = 5 * 1024 * 1024;

export type RosterPreview = {
  fileName: string;
  weekStart: string;
  people: number;
  newPeople: number;
  linked: number;
  shifts: number;
  holidays: number;
  leave: number;
  sites: { name: string; shifts: number }[];
  /** Days at places that are not sites in Turnfin: left out, counted by place. */
  leftOut: { place: string; codes: string[]; entries: number; people: number }[];
  problems: string[];
  /** Null on the week's first upload. */
  changes: { added: number; removed: number; changed: number; sample: RosterChange[] } | null;
};

type Read = { ok: true; fileName: string; roster: ParsedRoster } | { ok: false; error: string };

async function readUpload(formData: FormData): Promise<Read> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the roster file (.xlsx) to upload." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Upload the roster as an Excel file (.xlsx), as the payroll system exports it." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than a week's roster should be (5 MB)." };
  try {
    const sheets = await readWorkbook(file);
    const sheet = sheets.find((s) => /-W\d{1,2}/.test(s.sheet)) ?? sheets[0];
    if (!sheet) return { ok: false, error: "That file has no sheets." };
    return { ok: true, fileName: file.name, roster: parseRoster(sheet.sheet, sheet.data as unknown[][]) };
  } catch (error) {
    if (error instanceof RosterError) return { ok: false, error: error.message };
    return { ok: false, error: "That file could not be read as a roster export. Export the week again and upload the .xlsx." };
  }
}

/** Everything both steps need: who, the departments, the week's previous upload. */
async function plan(roster: ParsedRoster) {
  const who = await requireRotaActor();
  if (!who.manage || !who.orgId) throw new AuthorizationError("Managing the rota is required.");
  const orgId = who.orgId;
  const codes = [...new Set(roster.entries.map((e) => e.department))].sort();
  const clubs = await prisma.club.findMany({ where: { orgId, archivedAt: null }, select: { id: true, name: true } });
  // A code placed by hand earlier (a site chosen for it) still counts when the code list has no place for it.
  const saved = await prisma.rotaDepartment.findMany({ where: { orgId, code: { in: codes }, site: { archivedAt: null } }, select: { code: true, site: { select: { id: true, name: true } } } });
  const siteOf = new Map<string, { id: string; name: string }>();
  const labelOf = new Map<string, string>();
  const outside = new Map<string, string>();
  for (const code of codes) {
    const department = rosterDepartment(code);
    const site = siteForPlace(department.place, clubs) ?? saved.find((d) => d.code === code)?.site ?? null;
    labelOf.set(code, department.label);
    if (site) siteOf.set(code, site); else outside.set(code, department.place ?? "No site");
  }
  const kept = roster.entries.filter((e) => siteOf.has(e.department));
  const leftOut = [...new Set(outside.values())].sort().map((place) => {
    const entries = roster.entries.filter((e) => outside.get(e.department) === place);
    return { place, codes: [...outside].filter(([, p]) => p === place).map(([c]) => c), entries: entries.length, people: new Set(entries.map((e) => e.employeeNo)).size };
  });
  const people = roster.people.filter((p) => kept.some((e) => e.employeeNo === p.employeeNo));
  // Every site the file touches, and the rota permission there.
  const sites = [...new Map([...siteOf.values()].map((s) => [s.id, s])).values()];
  for (const site of sites) {
    try { await requireCapFor("rota.manage", { siteId: site.id, orgId }); }
    catch (error) {
      if (error instanceof AuthorizationError) throw new AuthorizationError(`This roster includes ${site.name}, which your rota role does not cover.`);
      throw error;
    }
  }
  const monday = roster.weekStart, sunday = addDaysIso(monday, 6);
  const previous = await prisma.rotaShift.findMany({
    where: { orgId, importId: { not: null }, cancelledAt: null, date: { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) } },
    select: { id: true, date: true, kind: true, startMinutes: true, endMinutes: true, departmentCode: true, note: true, rotaPerson: { select: { employeeNo: true, name: true } } },
  });
  const before: RosterEntry[] = previous.filter((s) => s.rotaPerson).map((s) => ({
    employeeNo: s.rotaPerson!.employeeNo, name: s.rotaPerson!.name, date: s.date.toISOString().slice(0, 10),
    kind: s.kind as RosterEntry["kind"], start: s.kind === "shift" ? s.startMinutes : 0, end: s.kind === "shift" ? s.endMinutes : 0,
    department: s.departmentCode ?? "", code: s.kind === "shift" ? "" : s.note,
  }));
  return { who, orgId, siteOf, labelOf, leftOut, kept, people, previous, before };
}

export async function previewRosterImport(formData: FormData): Promise<{ ok: true; preview: RosterPreview } | { ok: false; error: string }> {
  const read = await readUpload(formData);
  if (!read.ok) return read;
  const { roster, fileName } = read;
  let planned;
  try { planned = await plan(roster); } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
  const { orgId, siteOf, leftOut, kept, people, previous, before } = planned;
  const known = await prisma.rotaPerson.findMany({ where: { orgId, employeeNo: { in: people.map((p) => p.employeeNo) } }, select: { employeeNo: true, userId: true } });
  const accounts = await matchAccounts(orgId, people.filter((p) => !known.some((k) => k.employeeNo === p.employeeNo)));
  const bySite = new Map<string, number>();
  for (const e of kept) if (e.kind === "shift" && siteOf.has(e.department)) bySite.set(siteOf.get(e.department)!.name, (bySite.get(siteOf.get(e.department)!.name) ?? 0) + 1);
  const changes = previous.length ? diffRoster(before, kept) : null;
  return {
    ok: true,
    preview: {
      fileName, weekStart: roster.weekStart,
      people: people.length,
      newPeople: people.length - known.length,
      linked: known.filter((k) => k.userId).length + accounts.size,
      shifts: kept.filter((e) => e.kind === "shift").length,
      holidays: kept.filter((e) => e.kind === "holiday").length,
      leave: kept.filter((e) => e.kind === "leave").length,
      sites: [...bySite].map(([name, shifts]) => ({ name, shifts })).sort((a, b) => a.name.localeCompare(b.name)),
      leftOut, problems: roster.problems,
      changes: changes && {
        added: changes.filter((c) => c.kind === "added").length,
        removed: changes.filter((c) => c.kind === "removed").length,
        changed: changes.filter((c) => c.kind === "changed").length,
        sample: changes.slice(0, 12),
      },
    },
  };
}

/** Accounts for people new to the roster: linked only where exactly one
 *  active, unlinked account in the organisation has the same name. */
async function matchAccounts(orgId: string, people: readonly { employeeNo: string; name: string }[]) {
  if (!people.length) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { orgId, isActive: true, rotaPerson: null }, select: { id: true, name: true } });
  const out = new Map<string, string>();
  for (const person of people) {
    const matches = users.filter((u) => sameName(u.name, person.name));
    if (matches.length === 1) out.set(person.employeeNo, matches[0].id);
  }
  return out;
}

export async function applyRosterImport(formData: FormData): Promise<ActionResult> {
  const read = await readUpload(formData);
  if (!read.ok) return fail(read.error);
  const { roster, fileName } = read;
  let planned;
  try { planned = await plan(roster); } catch (error) {
    if (error instanceof AuthorizationError) return fail(error.message);
    throw error;
  }
  const { who, orgId, siteOf, labelOf, kept, people, previous, before } = planned;
  if (!kept.length) return fail("That roster has no shifts at Turnfin sites to import.");
  const accounts = await matchAccounts(orgId, people);
  const changes = previous.length ? diffRoster(before, kept) : [];

  const result = await prisma.$transaction(async (tx) => {
    // Everyone on the roster, by employee number; names follow the latest file.
    const personId = new Map<string, { id: string; userId: string | null }>();
    for (const p of people) {
      const existing = await tx.rotaPerson.findUnique({ where: { orgId_employeeNo: { orgId, employeeNo: p.employeeNo } }, select: { id: true, userId: true } });
      const saved = existing
        ? await tx.rotaPerson.update({ where: { id: existing.id }, data: { name: p.name, ...(existing.userId ? {} : { userId: accounts.get(p.employeeNo) ?? null }) }, select: { id: true, userId: true } })
        : await tx.rotaPerson.create({ data: { orgId, employeeNo: p.employeeNo, name: p.name, userId: accounts.get(p.employeeNo) ?? null }, select: { id: true, userId: true } });
      personId.set(p.employeeNo, saved);
    }
    const created = await tx.rotaImport.create({ data: {
      orgId, weekStart: parseDateOnly(roster.weekStart), fileName, importedById: who.id, importedByName: who.name,
      people: people.length,
      shifts: kept.filter((e) => e.kind === "shift").length,
      holidays: kept.filter((e) => e.kind === "holiday").length,
      added: changes.filter((c) => c.kind === "added").length,
      removed: changes.filter((c) => c.kind === "removed").length,
      changed: changes.filter((c) => c.kind === "changed").length,
    } });
    // The week's previous upload gives way to this one.
    if (previous.length) await tx.rotaShift.updateMany({ where: { id: { in: previous.map((s) => s.id) }, cancelledAt: null }, data: { cancelledAt: new Date() } });
    await tx.rotaShift.createMany({ data: kept.map((e) => {
      const person = personId.get(e.employeeNo)!;
      return {
        orgId, siteId: siteOf.get(e.department)!.id, date: parseDateOnly(e.date),
        startMinutes: e.start, endMinutes: e.end, kind: e.kind,
        role: labelOf.get(e.department) || `Department ${e.department}`,
        departmentCode: e.department, note: e.kind === "shift" ? "" : e.code,
        rotaPersonId: person.id, userId: person.userId, importId: created.id,
        createdById: who.id, createdByName: who.name,
      };
    }) });
    if (changes.length) await tx.rotaChange.createMany({ data: changes.map((c) => ({
      orgId, importId: created.id, date: parseDateOnly(c.date), employeeNo: c.employeeNo, personName: c.name, kind: c.kind, before: c.before, after: c.after,
    })) });
    await logAudit({
      actorId: who.id, actorName: who.name, action: previous.length ? "update" : "create", entity: "RotaImport", entityId: created.id, clubId: null,
      summary: previous.length
        ? `Uploaded a new roster for the week of ${roster.weekStart} (${fileName}): ${changes.length} ${changes.length === 1 ? "change" : "changes"}`
        : `Uploaded the roster for the week of ${roster.weekStart} (${fileName}): ${people.length} people`,
    }, tx);
    return ok();
  }, { timeout: 60_000 });
  if (result.ok) { revalidatePath("/rota"); revalidatePath("/rota/changes"); revalidatePath("/rota/absences"); }
  return result;
}
