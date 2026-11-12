import { serverModule } from "@/test/server-module";

type Planned = typeof import("@/modules/activities/shared/courses/planned");

/** The swim school's real day-teacher rules (`dayTeacherId`, `withPlanned`, the grace day) with no
 *  database: `plannedTeachers` answers from `plan`, the rota's plan for the classes asked about. */
export function plannedDouble(plan: ReadonlyMap<string, { teacherId: string | null; teacherName: string | null }> = new Map()): Planned {
  const real = serverModule<Planned>("src/modules/activities/shared/courses/planned.ts", {
    "@/lib/prisma": { prisma: {} },
    "@/modules/activities/shared/courses/data/courses": { getCoursesOnDay: async () => [] },
  });
  return { ...real, plannedTeachers: async (ids: readonly string[]) => new Map([...plan].filter(([id]) => ids.includes(id))) };
}
