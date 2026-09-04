import { redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { homePathFor } from "@/lib/staff/permissions";

/** Where a sign-in lands. The role says whether the day starts on the
 *  overview or on the deck; this page reads it and goes there, so the
 *  sign-in form never has to know about roles. */
export default async function StartPage() {
  const session = await pageSession();
  redirect(homePathFor(session.user.home, session.user.permissions));
}
