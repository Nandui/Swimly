import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_GROUPS, type CoreLinkKey } from "@/components/core/pages";
import { ModuleStart } from "@/components/workspace/module-start";
import { Award, ClipboardCheck, Euro, Files, GraduationCap, ShieldAlert, Truck, Waves } from "lucide-react";
import { can, canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Admin" };

/** Admin's starter page: what waits to be checked (details changes sent from
 *  Turnfin Me), and the Admin pages this person can open. Someone who can open
 *  none of them goes Home (their own Account lives outside Admin, at /account);
 *  each page still asks for its own screen and permission. Grouped by topic as the
 *  page bar is, from the one list in components/core/pages.ts. */
export default async function CoreHome() {
  const session = await pageSession();
  const groups = ADMIN_GROUPS.slice(1).map((g) => ({
    label: g.label,
    links: g.links.filter((l) => l.key === "apps" ? session.user.isSuperadmin === true : canSee(session, l.key as Exclude<CoreLinkKey, "apps">)).map(({ href, label, icon, description }) => ({ href, label, icon, description })),
  })).filter((g) => g.links.length);
  // Setup that belongs to one module stays in it; Admin lists where each is (owner decision, 7 October 2026).
  const modules = [
    { show: canSee(session, "programmes") && can(session, "curriculum.manage"), href: "/programmes", label: "Swim school programmes", icon: Waves, description: "Programmes, levels, competencies and assessment types" },
    { show: canSee(session, "cancellations") && can(session, "curriculum.manage"), href: "/cancellations/prices", label: "Swim school billing prices", icon: Euro, description: "Each Legend agreement price's monthly price, for putting members back after a cancellation" },
    { show: canSee(session, "training") && can(session, "training.manage"), href: "/training/courses", label: "Training courses", icon: GraduationCap, description: "The courses staff are assigned and complete" },
    { show: canSee(session, "purchasing"), href: "/purchasing/suppliers", label: "Purchasing suppliers", icon: Truck, description: "Approved suppliers, their products and who approves" },
    { show: canSee(session, "short-courses"), href: "/short-courses/academy/types", label: "Academy courses", icon: Award, description: "The lifeguard and swim teacher courses we deliver" },
    { show: canSee(session, "tasks") && can(session, "tasks.manage"), href: "/tasks/templates", label: "Task templates", icon: ClipboardCheck, description: "What each site's daily checks ask for, for whom and when" },
    { show: canSee(session, "docs") && can(session, "docs.manage"), href: "/docs/admin", label: "Docs settings", icon: Files, description: "Document teams, templates and the risk matrix" },
    { show: canSee(session, "incidents") && can(session, "incidents.reports.signoff"), href: "/incidents/settings", label: "Incidents settings", icon: ShieldAlert, description: "Who gets requests to HR" },
  ].flatMap(({ show, ...m }) => (show ? [m] : []));
  if (modules.length) groups.push({ label: "Apps", links: modules });
  if (groups.length === 0) redirect("/");
  return <ModuleStart id="admin" groups={groups} />;
}
