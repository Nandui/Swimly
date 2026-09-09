import { z } from "zod";
const id = z.string().min(1).max(120);
export const lessonDataSchema = z.object({
  attendance: z
    .record(
      id,
      z.object({
        status: z.enum(["PRESENT", "LATE", "ABSENT"]).nullable(),
        note: z.string().max(200),
      }),
    )
    .refine((rows) => Object.keys(rows).length <= 200),
  competencies: z
    .record(id, z.record(id, z.enum(["WORKING_ON", "ACHIEVED"]).nullable()))
    .refine(
      (rows) =>
        Object.values(rows).reduce(
          (count, skills) => count + Object.keys(skills).length,
          0,
        ) <= 2000,
    ),
  note: z.string().max(300),
});
export type LessonData = z.infer<typeof lessonDataSchema>;
export type SavedLesson = {
  revision: string;
  data: LessonData;
  complete: boolean;
};
export type LessonSaveInput = {
  courseId: string;
  date: string;
  revision: string;
  data: LessonData;
  complete?: boolean;
};
export type LessonSaveResult =
  | { ok: true; saved: SavedLesson }
  | { ok: false; error: string; conflict?: SavedLesson; retry?: boolean };
export type SaveState =
  | "idle"
  | "queued"
  | "saving"
  | "saved"
  | "offline"
  | "error"
  | "conflict";
export const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function sameKeys(a: object, b: object) {
  return same(Object.keys(a).sort(), Object.keys(b).sort());
}
/** Reapply only local changes over the reviewed server record. New roster
 * entries and changes made by colleagues in untouched fields survive. */
export function rebaseDraft(
  base: LessonData,
  mine: LessonData,
  saved: LessonData,
): LessonData {
  const next = structuredClone(saved);
  for (const id of Object.keys(next.attendance))
    if (mine.attendance[id] && !same(base.attendance[id], mine.attendance[id]))
      next.attendance[id] = mine.attendance[id];
  for (const [id, skills] of Object.entries(next.competencies))
    for (const skill of Object.keys(skills))
      if (
        mine.competencies[id] &&
        skill in mine.competencies[id] &&
        base.competencies[id]?.[skill] !== mine.competencies[id][skill]
      )
        skills[skill] = mine.competencies[id][skill];
  if (base.note !== mine.note) next.note = mine.note;
  return next;
}
