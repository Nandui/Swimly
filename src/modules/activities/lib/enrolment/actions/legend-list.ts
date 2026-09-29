"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { currentClubId } from "@/lib/clubs/current";
import { sitesByIds } from "@/lib/directory";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { readWorkbook } from "@/lib/xlsx";
import { courseLabel } from "@/modules/activities/lib/courses/constants";
import { getSharedCurriculum } from "@/modules/activities/lib/curriculum/data/shared";
import { agreementRecord } from "@/modules/activities/lib/enrolment/legend-agreement";
import { LegendListError, parseLegendList, planLegendMatch, type LegendMember } from "@/modules/activities/lib/enrolment/legend-list";
import { fullName } from "@/modules/activities/lib/students/constants";

/** Confirming Legend agreements from a list exported from Legend (docs/legend-agreements.md).
 *  A check first, which writes nothing; then the confirmation, which reads
 *  the file again. Only outstanding places at the working site are touched,
 *  each exactly as "Confirm updated" would: the same record and audit entry. */

const MAX_BYTES = 10 * 1024 * 1024;
const OUTSTANDING = ["NEEDS_CHECK", "PENDING"] as const;

export type LegendReviewRow = { id: string; swimmer: string; memberNumber: string; place: string; programme: string; priceName?: string };
export type LegendListPreview = {
  fileName: string;
  listed: number;
  confirm: number;
  confirmSample: LegendReviewRow[];
  mismatch: LegendReviewRow[];
  terminated: LegendReviewRow[];
  alreadyConfirmed: number;
  otherSite: number;
  notFound: number;
  siteName: string;
};

async function readList(formData: FormData): Promise<{ ok: true; fileName: string; members: LegendMember[] } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the list exported from Legend (.xlsx)." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Upload the Legend list as an Excel file (.xlsx)." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than a Legend list should be (10 MB)." };
  try {
    const sheets = await readWorkbook(file);
    const sheet = sheets.find((s) => s.sheet.toLowerCase() === "data") ?? sheets[0];
    if (!sheet) return { ok: false, error: "That file has no sheets." };
    const members = parseLegendList(sheet.data as unknown[][], today());
    if (!members.length) return { ok: false, error: "No member numbers were found in that list." };
    return { ok: true, fileName: file.name, members };
  } catch (error) {
    if (error instanceof LegendListError) return { ok: false, error: error.message };
    return { ok: false, error: "That file could not be read. Export the list from Legend again and upload the .xlsx." };
  }
}

/** The list against the swim school: every outstanding place of a listed
 *  member (any site, so another site's places can be counted), and who has
 *  an active place at all. */
async function plan(members: LegendMember[]) {
  const clubId = await currentClubId();
  const numbers = members.map((m) => m.memberNumber);
  const [rows, known, curriculum, site] = await Promise.all([
    prisma.enrolment.findMany({
      where: { status: "ACTIVE", legendAgreementStatus: { in: [...OUTSTANDING] }, student: { memberNumber: { in: numbers } } },
      select: { id: true, programmeId: true,
        student: { select: { firstName: true, lastName: true, memberNumber: true } },
        course: { select: { clubId: true, name: true, dayOfWeek: true, startMinutes: true, level: { select: { id: true, name: true } } } } },
    }),
    prisma.student.findMany({ where: { memberNumber: { in: numbers }, enrolments: { some: { status: "ACTIVE" } } }, select: { memberNumber: true } }),
    getSharedCurriculum(),
    sitesByIds([clubId]).then((sites) => sites.get(clubId)),
  ]);
  const places = rows.map((r) => {
    const level = curriculum.level(r.course.level.id);
    return {
      id: r.id, memberNumber: r.student.memberNumber, siteId: r.course.clubId,
      programmeName: curriculum.programme(r.programmeId)?.name ?? "", levelName: level?.name ?? r.course.level.name,
      swimmer: fullName(r.student),
      label: courseLabel({ ...r.course, level: { ...r.course.level, name: level?.name ?? r.course.level.name } }),
    };
  });
  const result = planLegendMatch(members, places, clubId, new Set(known.flatMap((k) => (k.memberNumber ? [k.memberNumber.toUpperCase()] : []))));
  const info = new Map(places.map((p) => [p.id, p]));
  const review = (p: { id: string; priceName?: string }): LegendReviewRow => {
    const place = info.get(p.id)!;
    return { id: p.id, swimmer: place.swimmer, memberNumber: place.memberNumber ?? "", place: place.label, programme: place.programmeName, ...(p.priceName ? { priceName: p.priceName } : {}) };
  };
  return { clubId, siteName: site?.name ?? "this site", result, review };
}

export async function previewLegendList(formData: FormData): Promise<{ ok: true; preview: LegendListPreview } | { ok: false; error: string }> {
  await requirePermission("enrolment.manage");
  const read = await readList(formData);
  if (!read.ok) return read;
  const { siteName, result, review } = await plan(read.members);
  return {
    ok: true,
    preview: {
      fileName: read.fileName, listed: result.listed, siteName,
      confirm: result.confirm.length, confirmSample: result.confirm.slice(0, 8).map(review),
      mismatch: result.mismatch.map(review), terminated: result.terminated.map(review),
      alreadyConfirmed: result.alreadyConfirmed, otherSite: result.otherSite, notFound: result.notFound.length,
    },
  };
}

export async function applyLegendList(formData: FormData): Promise<ActionResult & { confirmed?: number }> {
  const actor = await requirePermission("enrolment.manage");
  const read = await readList(formData);
  if (!read.ok) return fail(read.error);
  const { clubId, result, review } = await plan(read.members);
  const ids = result.confirm.map((p) => p.id);
  if (!ids.length) return fail("Nothing on this list is waiting to be confirmed at this site.");
  const outcome = await prisma.$transaction(async (tx) => {
    // Only places still active and outstanding: anything confirmed, moved or
    // ended since the check is left as it is.
    const still = await tx.enrolment.findMany({ where: { id: { in: ids }, status: "ACTIVE", legendAgreementStatus: { in: [...OUTSTANDING] }, course: { clubId } }, select: { id: true, programmeId: true } });
    await tx.enrolment.updateMany({ where: { id: { in: still.map((s) => s.id) } }, data: agreementRecord("DONE", actor.user) });
    for (const row of still) {
      const r = review({ id: row.id });
      await logAudit({ actorId: actor.user.id, actorName: actor.user.name ?? "Unknown", action: "legend-agreement",
        entity: "Enrolment", entityId: row.id, programmeId: row.programmeId, clubId,
        summary: `Confirmed the Legend billing agreement is updated for ${r.swimmer} in ${r.place}, from the Legend list ${read.fileName}`,
      }, tx);
    }
    return still.length;
  }, { timeout: 120_000 });
  revalidatePath("/legend-agreements");
  revalidatePath("/students/[id]", "page");
  revalidatePath("/courses/[id]", "page");
  return { ...ok(), confirmed: outcome };
}
