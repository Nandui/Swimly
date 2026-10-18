import { z } from "zod";
import { HISTORY_KINDS } from "@/modules/activities/features/students/server/history";

/** How a swimmer's history is read and asked for, checked on the server. Apart from
 *  history.ts so the profile screen, which shares its labels, does not load the checks. */
const mark = z.enum(["ACHIEVED", "WORKING_ON"]).nullable();
export const evidenceSchema = z.object({
  version: z.literal(1), kind: z.string(), date: z.string().optional(), courseId: z.string().nullable().optional(),
  levelId: z.string().optional(), before: z.string().nullable().optional(), after: z.string().nullable().optional(),
  note: z.string().nullable().optional(), previousNote: z.string().nullable().optional(), taughtBy: z.string().nullable().optional(),
  changes: z.array(z.object({ competencyId: z.string(), name: z.string(), before: mark, after: mark })).optional(),
});
export const historyQuerySchema = z.object({
  kind: z.enum(HISTORY_KINDS).optional(), courseId: z.string().max(100).optional(),
  programmeId: z.string().max(100).optional(), competencyId: z.string().max(100).optional(),
  from: z.string().max(10).optional(), to: z.string().max(10).optional(), q: z.string().max(160).optional(),
  cursor: z.object({ at: z.iso.datetime(), id: z.string().max(150) }).optional(),
});
