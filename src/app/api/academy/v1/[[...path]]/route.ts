import { handleAcademyRequest } from "@/lib/academy/public/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleAcademyRequest(request, (await context.params).path ?? []);
}
export { handle as GET, handle as POST, handle as OPTIONS, handle as HEAD };
