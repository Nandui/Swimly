import { appRoute } from "@/lib/apps/switches";
import { handleParentRequest } from "@/modules/activities/features/parents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleParentRequest(request, (await context.params).path ?? []);
}
const served = appRoute("swim-school", handle);
export { served as GET, served as POST, served as PATCH, served as PUT, served as DELETE, served as OPTIONS, served as HEAD };
