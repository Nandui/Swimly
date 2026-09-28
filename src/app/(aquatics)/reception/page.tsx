import { redirect } from "next/navigation";
import { canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import { homePathFor } from "@/lib/staff/screens";

/** Reception is retired. Preserve bookmarks without offering the removed view
 * or granting access to a screen the user's role does not already include. */
export default async function RetiredReceptionPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await pageSession();
  if (canSee(session, "students")) {
    const params = await searchParams;
    const swimmerId = typeof params.swimmer === "string" && params.swimmer.length <= 120 ? params.swimmer : null;
    redirect(swimmerId ? `/students/${encodeURIComponent(swimmerId)}` : "/students");
  }
  redirect(homePathFor(session.user.home, session.user.permissions, session.user.screens));
}
