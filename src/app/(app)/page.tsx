import { redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { homePathFor } from "@/lib/staff/screens";

/** Overview is retired. Keep root bookmarks useful without loading its data
 *  or granting a screen that the signed-in person cannot access. */
export default async function HomePage() {
  const session = await pageSession();
  redirect(homePathFor(session.user.home, session.user.permissions, session.user.screens));
}
