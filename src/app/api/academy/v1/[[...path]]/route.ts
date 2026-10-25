import { appRoute } from "@/lib/apps/switches";
import { handleAcademyRequest } from "@/modules/short-courses/features/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleAcademyRequest(request, (await context.params).path ?? []);
}
const served = appRoute("short-courses", handle);
export { served as GET, served as POST, served as OPTIONS, served as HEAD };
