import { handleParentAdminRequest } from "@/lib/parent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleParentAdminRequest(request, (await context.params).path ?? []);
}
export { handle as GET, handle as PUT, handle as PATCH, handle as DELETE, handle as POST, handle as OPTIONS, handle as HEAD };
