import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_GROUPS, type CoreLinkKey } from "@/components/core/pages";
import { ModuleOverview } from "@/components/workspace/module-overview";
import { Award, ClipboardCheck, Euro, Files, GraduationCap, Truck, Waves } from "lucide-react";
import { can, canSee } from "@/lib/authz";
import { loadModuleOverview } from "@/lib/home";
import { pageSession } from "@/lib/page-guards";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Admin" };

/** Admin's first page: what waits to be checked (details changes sent from
 *  Turnfin Me), and the Admin pages this person can open. Someone who can open
 *  none of them goes Home (their own Account lives outside Admin, at /account);
 *  each page still asks for its own screen and permission. Grouped by topic as the
 *  page bar is, from the one list in components/core/pages.ts. */
export default async function CoreHome() {
  const session = await pageSession();
  const groups = ADMIN_GROUPS.slice(1).map((g) => ({
    label: g.label,
    links: g.links.filter((l) => canSee(session, l.key as CoreLinkKey)).map(({ href, label, icon, description }) => ({ href, label, icon, description })),
  })).filter((g) => g.links.length);
  // Setup that belongs to one module stays in it; Admin lists where each is (owner decision, 7 October 2026).
  const modules = [
    { show: canSee(session, "programmes") && can(session, "curriculum.manage"), href: "/programmes", label: "Swim school programmes", icon: Waves, description: "Programmes, levels, competencies and assessment types" },
    { show: canSee(session, "cancellations") && can(session, "curriculum.manage"), href: "/cancellations/prices", label: "Swim school billing prices", icon: Euro, description: "Each Legend agreement price's monthly price, for putting members back after a cancellation" },
    { show: canSee(session, "training") && can(session, "training.manage"), href: "/training/courses", label: "Training courses", icon: GraduationCap, description: "The courses staff are assigned and complete" },
    { show: canSee(session, "purchasing"), href: "/purchasing/suppliers", label: "Purchasing suppliers", icon: Truck, description: "Approved suppliers, their products and who approves" },
    { show: canSee(session, "academy"), href: "/academy/types", label: "Academy courses", icon: Award, description: "The lifeguard and swim teacher courses we deliver" },
    { show: canSee(session, "tasks") && can(session, "tasks.manage"), href: "/tasks/templates", label: "Task templates", icon: ClipboardCheck, description: "What each site's daily checks ask for, for whom and when" },
    { show: canSee(session, "docs") && can(session, "docs.manage"), href: "/docs/admin", label: "Docs settings", icon: Files, description: "Document teams, templates and the risk matrix" },
  ].flatMap(({ show, ...m }) => (show ? [m] : []));
  if (modules.length) groups.push({ label: "Modules", links: modules });
  if (groups.length === 0) redirect("/");
  const { items, siteName, failed } = await loadModuleOverview("admin");
  const mod = allModules().find((m) => m.id === "admin")!;
  return <ModuleOverview name={mod.name} description={mod.description} icon={mod.icon} siteName={siteName} items={items} failed={failed} groups={groups} />;
}
