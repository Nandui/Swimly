import { auth } from "@/auth";
import { emailLogo } from "@/lib/email/logo";

export const runtime = "nodejs";

/** The logo for the purchase order email preview, which cannot show the `cid:` image the
 *  sent email carries. Signed-in staff only, like the rest of Turnfin. */
export async function GET() {
  // Route handlers do not inherit the Purchasing layout's sign-in guard.
  const session = await auth();
  const headers = { "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
  if (!session?.user) return new Response(null, { status: 401, headers });
  return new Response(new Uint8Array(await emailLogo()), { headers: { ...headers, "Content-Type": "image/png" } });
}
