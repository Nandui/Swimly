import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openSession, STATE_COOKIE } from "@/access/open-session";
import { readPass, turnfinConfig } from "@/access/pass";
import { accountOf, PERSON } from "@/access/session";
import { db } from "@/data/db";

/** Where Turnfin sends the browser back with its pass ("Continue with Turnfin",
 *  src/access/pass.ts). A pass that is exactly right opens a session; anything else goes back
 *  to sign-in with one sentence, whatever the reason. */
export async function GET(request: Request) {
  const turnfin = turnfinConfig();
  const jar = await cookies();
  const state = jar.get(STATE_COOKIE)?.value;
  // One use: the state is spent whether or not the pass is good.
  jar.delete(STATE_COOKIE);

  const named = turnfin && readPass({ pass: new URL(request.url).searchParams.get("pass"), state, secret: turnfin.secret });
  if (!named) redirect("/sign-in?error=turnfin");

  const person = await db.user.findUnique({ where: { id: named.userId }, select: PERSON });
  const account = person && accountOf(person);
  if (!account) redirect("/sign-in?error=turnfin");

  await openSession(account, "turnfin");
  redirect("/");
}
