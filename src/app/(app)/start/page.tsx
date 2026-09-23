import { redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { homePathFor } from "@/lib/staff/screens";

/** Open Swimly from the staff portal. The role determines the workspace;
 *  the portal never needs to know which screens this person can access. */
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const session = await pageSession();
  const query = await searchParams;
  redirect(homePathFor(session.user.home, session.user.permissions, session.user.screens, query.workspace === "desk" ? "desk" : "all"));
}
