import { z } from "zod";
import { isDateOnly, today } from "@/lib/format";
import { assignInstructor } from "@/modules/activities/features/classes-api/server/actions";
import { apiSites, listInstructors, listLessons } from "@/modules/activities/features/classes-api/server/data";
import { ClassesApiError, authenticateApp, classesResponse, idSchema, json, parseInput, rateLimit, requestIp } from "@/modules/activities/features/classes-api/server/http";

/** /api/classes/v1: how an outside app reads the swim school's timetable and says
 *  who teaches a lesson. Server to server: each app sends its own key as a Bearer token.
 *  See docs/architecture.md, Connected products.
 *
 *  GET sites                      the sites with classes
 *  GET classes?from=&days=&site=  each lesson in the days asked for (today and the six after it
 *                                 when nothing is asked): id, date, times, name, programme, level,
 *                                 site and that day's instructor
 *  GET instructors                the staff a class can be given to
 *  PUT classes/{id}/instructor    { date, instructorId | instructorEmail | instructorName }:
 *                                 plans that lesson's instructor, as the rota's Plan does */
const query = z.object({
  from: z.string().refine(isDateOnly, "Send from as YYYY-MM-DD.").optional(),
  days: z.coerce.number().int().min(1, "Ask for 1 to 31 days.").max(31, "Ask for 1 to 31 days.").optional(),
  site: idSchema.optional(),
});

export async function handleClassesRequest(request: Request, path: string[]) {
  return classesResponse(request, async () => {
    const route = path.join("/"), method = request.method;
    const assign = /^classes\/([A-Za-z0-9_-]+)\/instructor$/.exec(route);
    const methods = assign ? ["PUT"] : ["sites", "classes", "instructors"].includes(route) ? ["GET"] : null;
    // Wrong keys are counted by address before anything is read, so a key cannot be guessed at speed.
    await rateLimit(`ip:${requestIp(request)}`, 300, 60);
    const app = authenticateApp(request);
    await rateLimit(`app:${app.name}`, 120, 60);
    if (!methods) throw new ClassesApiError(404, "NOT_FOUND", "There is nothing here.");
    if (!methods.includes(method)) throw new ClassesApiError(405, "METHOD_NOT_ALLOWED", "This endpoint does not accept that method.", { Allow: methods.join(", ") });
    if (assign) return json({ class: await assignInstructor(request, app, parseInput(idSchema, assign[1])) });
    if (route === "sites") return json({ sites: await apiSites() });
    if (route === "instructors") return json({ instructors: await listInstructors() });
    const asked = parseInput(query, Object.fromEntries(new URL(request.url).searchParams));
    const from = asked.from ?? today(), days = asked.days ?? 7;
    return json({ from, days, classes: await listLessons({ from, days, siteId: asked.site }) });
  });
}
