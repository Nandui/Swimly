import { handleStaffRequest } from "@/lib/staff-api/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleStaffRequest(request, (await context.params).path ?? []);
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as OPTIONS, handle as HEAD };
