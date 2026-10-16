import { applyTrainingRules } from "@/modules/training/features/compliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily (Vercel cron), before the 07:00 reminder digest: runs every training rule, assigning
 *  courses to the people they cover who have never finished them or are due again. Running it
 *  twice is harmless. Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await applyTrainingRules(), { headers: { "Cache-Control": "no-store" } });
}
