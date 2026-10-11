import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { permissionsOf } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import { visibleScreens } from "@/lib/staff/screens";
import { visibleNavGroups } from "@/modules/activities/features/workspace";

export const metadata: Metadata = { title: "Swim school" };

/** The swim school's starter page: the desk's quick actions, today's classes on a timeline,
 *  today at the working site, the follow-up queues, and every desk page it can open. */
export default async function SwimSchoolOverviewPage() {
  const session = await pageSession();
  const screens = visibleScreens(permissionsOf(session));
  const groups = visibleNavGroups(screens).map((group) => ({
    label: group.label,
    links: group.items.map(({ href, label, icon, description }) => ({ href, label, icon, description: description ?? "" })),
  }));
  return <ModuleStart id="swim-school" groups={groups} />;
}
