import { redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { homePathFor } from "@/lib/staff/screens";

/** Where a sign-in lands. The role says whether the day starts on the
 *  overview or on the deck, and which screens exist at all; this page reads
 *  both and goes there, so the sign-in form never has to know about roles. */
export default async function StartPage() {
  const session = await pageSession();
  redirect(homePathFor(session.user.home, session.user.permissions, session.user.screens));
}
