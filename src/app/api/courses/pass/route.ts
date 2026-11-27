import { auth } from "@/auth";
import { coursesPassConfig, isPassState, signPass } from "@/lib/courses-pass";

/** "Continue with Turnfin", for Turnfin Courses (src/lib/courses-pass.ts, docs/courses.md).
 *  Courses sends the browser here with a state it made. Whoever is signed in to Turnfin is
 *  sent back to Courses with a one-minute signed pass; anyone else signs in first, the way
 *  they always do, and then comes back through here. The pass goes only to COURSES_URL. */
export async function GET(request: Request) {
  const config = coursesPassConfig();
  const state = new URL(request.url).searchParams.get("state");
  if (!config || !isPassState(state)) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const session = await auth();
  const to = session?.user?.id
    ? `${config.coursesUrl}/sign-in/turnfin?pass=${signPass({ userId: session.user.id, state, secret: config.secret })}`
    : `/sign-in?courses=${state}`;
  return new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
