import { redirect } from "next/navigation";
import { canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";

/** The Core workspace's front door: the first Core screen this person can
 *  open, otherwise their own Account. */
export default async function CoreHome() {
  const session = await pageSession();
  for (const [screen, path] of [["staff", "/staff"], ["roles", "/roles"], ["clubs", "/clubs"], ["activity", "/activity"]] as const) {
    if (canSee(session, screen)) redirect(path);
  }
  redirect("/account");
}
