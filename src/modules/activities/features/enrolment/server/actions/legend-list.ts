"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { sitesByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { readWorkbook } from "@/lib/xlsx";
import { courseLabelWithSite } from "@/modules/activities/shared/courses/constants";
import { agreementRecord } from "@/modules/activities/shared/enrolment/legend-agreement";
import { LegendListError, parseLegendList, placesToConfirm } from "@/modules/activities/features/enrolment/server/legend-list";
import { fullName } from "@/modules/activities/shared/students/constants";

/** Confirming Legend agreements from a list exported from Legend
 *  (docs/legend-agreements.md): every outstanding place whose swimmer's
 *  member number is on the list, at every site where this person may
 *  confirm (`enrolment.manage`). A count first, which writes nothing; then
 *  the confirmation, which reads the file again. Each place is recorded as
 *  "Confirm updated" would record it: the person's name and an audit entry. */

const MAX_BYTES = 10 * 1024 * 1024;
const OUTSTANDING = ["NEEDS_CHECK", "PENDING"] as const;

export type LegendListPreview = { fileName: string; members: number; places: number; swimmers: number; bySite: { name: string; places: number }[] };

async function readList(formData: FormData): Promise<{ ok: true; fileName: string; numbers: string[] } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the list exported from Legend (.xlsx)." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Upload the Legend list as an Excel file (.xlsx)." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than a Legend list should be (10 MB)." };
  try {
    const sheets = await readWorkbook(file);
    const sheet = sheets.find((s) => s.sheet.toLowerCase() === "data") ?? sheets[0];
    if (!sheet) return { ok: false, error: "That file has no sheets." };
    const numbers = parseLegendList(sheet.data as unknown[][]);
    if (!numbers.length) return { ok: false, error: "No member numbers were found in that list." };
    return { ok: true, fileName: file.name, numbers };
  } catch (error) {
    if (error instanceof LegendListError) return { ok: false, error: error.message };
    return { ok: false, error: "That file could not be read. Export the list from Legend again and upload the .xlsx." };
  }
}

/** The outstanding places of listed members, where this person may confirm. */
async function matched(numbers: string[]) {
  await requireSession();
  const sites = await sitesFor("enrolment.manage");
  if (sites.kind === "some" && sites.siteIds.size === 0) return null;
  const rows = await prisma.enrolment.findMany({
    where: { status: "ACTIVE", legendAgreementStatus: { in: [...OUTSTANDING] }, student: { memberNumber: { in: numbers } },
      ...(sites.kind === "all" ? {} : { course: { clubId: { in: [...sites.siteIds] } } }) },
    select: { id: true, programmeId: true, studentId: true,
      student: { select: { firstName: true, lastName: true, memberNumber: true } },
      course: { select: { clubId: true, name: true, dayOfWeek: true, startMinutes: true, level: { select: { name: true } } } } },
  });
  const places = placesToConfirm(numbers, rows.map((r) => ({ ...r, memberNumber: r.student.memberNumber, siteId: r.course.clubId })), sites.kind === "all" ? "all" : sites.siteIds);
  return { places, siteNames: await sitesByIds([...new Set(places.map((p) => p.siteId))]) };
}

export async function previewLegendList(formData: FormData): Promise<{ ok: true; preview: LegendListPreview } | { ok: false; error: string }> {
  const read = await readList(formData);
  if (!read.ok) return read;
  const found = await matched(read.numbers);
  if (!found) return { ok: false, error: "Your role cannot confirm Legend agreements at any site." };
  const bySite = new Map<string, number>();
  for (const p of found.places) bySite.set(p.siteId, (bySite.get(p.siteId) ?? 0) + 1);
  return { ok: true, preview: {
    fileName: read.fileName, members: read.numbers.length, places: found.places.length,
    swimmers: new Set(found.places.map((p) => p.studentId)).size,
    bySite: [...bySite].map(([id, places]) => ({ name: found.siteNames.get(id)?.name ?? "Another site", places })),
  } };
}

export async function applyLegendList(formData: FormData): Promise<ActionResult & { confirmed?: number }> {
  const read = await readList(formData);
  if (!read.ok) return fail(read.error);
  const session = await requireSession();
  const found = await matched(read.numbers);
  if (!found) return fail("Your role cannot confirm Legend agreements at any site.");
  if (!found.places.length) return fail("Nobody on this list has a place waiting to be confirmed.");
  const actor = { id: session.user.id, name: session.user.name ?? "Unknown" };
  const confirmed = await prisma.$transaction(async (tx) => {
    // Only places still active and outstanding: anything confirmed, moved or
    // ended since the count is left as it is.
    const still = await tx.enrolment.findMany({ where: { id: { in: found.places.map((p) => p.id) }, status: "ACTIVE", legendAgreementStatus: { in: [...OUTSTANDING] } }, select: { id: true } });
    await tx.enrolment.updateMany({ where: { id: { in: still.map((s) => s.id) } }, data: agreementRecord("DONE", actor) });
    for (const { id } of still) {
      const p = found.places.find((x) => x.id === id)!;
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "legend-agreement", entity: "Enrolment", entityId: id, programmeId: p.programmeId, clubId: p.siteId,
        summary: `Confirmed the Legend billing agreement is updated for ${fullName(p.student)} in ${courseLabelWithSite({ ...p.course, club: found.siteNames.get(p.siteId) })}, from the Legend list ${read.fileName}`,
      }, tx);
    }
    return still.length;
  }, { timeout: 120_000 });
  revalidatePath("/legend-agreements");
  revalidatePath("/students/[id]", "page");
  revalidatePath("/courses/[id]", "page");
  return { ...ok(), confirmed };
}
