import { appRoute } from "@/lib/apps/switches";
import { handleParentAdminRequest } from "@/modules/activities/features/parents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleParentAdminRequest(request, (await context.params).path ?? []);
}
const served = appRoute("swim-school", handle);
export { served as GET, served as PUT, served as PATCH, served as DELETE, served as POST, served as OPTIONS, served as HEAD };
