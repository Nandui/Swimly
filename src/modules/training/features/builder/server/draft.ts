import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { cleanDoc, isLessonKind, type Outline } from "@/modules/training/shared/lessons";

/** The course draft as an outline: what the builder shows, what Preview plays
 *  and what Publish freezes into a version. */

export const DRAFT_SELECT = {
  sections: {
    orderBy: { position: "asc" },
    select: { id: true, title: true, lessons: { orderBy: { position: "asc" }, select: { id: true, kind: true, title: true, body: true, videoUrl: true, fileId: true, minutes: true } } },
  },
} as const satisfies Prisma.TrainingCourseSelect;

type DraftRows = Prisma.TrainingCourseGetPayload<{ select: typeof DRAFT_SELECT }>;

export function draftOutline(rows: DraftRows): Outline {
  return { sections: rows.sections.map((s) => ({
    id: s.id, title: s.title,
    lessons: s.lessons.filter((l) => isLessonKind(l.kind)).map((l) => ({
      id: l.id, kind: l.kind as Outline["sections"][number]["lessons"][number]["kind"], title: l.title, body: cleanDoc(l.body),
      videoUrl: l.videoUrl, fileId: l.fileId, minutes: l.minutes,
    })),
  })) };
}

export async function loadDraft(tx: Prisma.TransactionClient, courseId: string) {
  const rows = await tx.trainingCourse.findUnique({ where: { id: courseId }, select: DRAFT_SELECT });
  return rows ? draftOutline(rows) : null;
}
