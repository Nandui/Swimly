import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { cleanDoc, cleanLessonData, isLessonKind, type LessonKind, type Outline } from "@/modules/training/shared/lessons";
import { normaliseQuestion, readExam, type Question } from "@/modules/training/shared/questions";

/** The course draft as an outline: what the builder shows, what Preview plays
 *  and what Publish freezes into a version. */

export const DRAFT_SELECT = {
  exam: true,
  sections: {
    orderBy: { position: "asc" },
    select: {
      id: true, title: true,
      lessons: { orderBy: { position: "asc" }, select: { id: true, kind: true, title: true, body: true, videoUrl: true, fileId: true, minutes: true, data: true } },
      questions: { orderBy: { position: "asc" }, select: { id: true, sectionId: true, kind: true, prompt: true, imageId: true, options: true, explanation: true } },
    },
  },
} as const satisfies Prisma.TrainingCourseSelect;

type DraftRows = Prisma.TrainingCourseGetPayload<{ select: typeof DRAFT_SELECT }>;

export function draftOutline(rows: DraftRows): Outline {
  return {
    exam: readExam(rows.exam),
    questions: rows.sections.flatMap((s) => s.questions.map((q) => normaliseQuestion(q, () => "x")).filter((q): q is Question => !!q)),
    sections: rows.sections.map((s) => ({
      id: s.id, title: s.title,
      lessons: s.lessons.filter((l) => isLessonKind(l.kind)).map((l) => ({
        id: l.id, kind: l.kind as LessonKind, title: l.title, body: cleanDoc(l.body),
        videoUrl: l.videoUrl, fileId: l.fileId, minutes: l.minutes, data: cleanLessonData(l.kind as LessonKind, l.data, () => "x", true),
      })),
    })),
  };
}

export async function loadDraft(tx: Prisma.TransactionClient, courseId: string) {
  const rows = await tx.trainingCourse.findUnique({ where: { id: courseId }, select: DRAFT_SELECT });
  return rows ? draftOutline(rows) : null;
}
