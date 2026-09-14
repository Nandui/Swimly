import type { Session } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { expandPermissions } from "@/lib/staff/permissions";
import { homePathFor, screenMeta, visibleScreens } from "@/lib/staff/screens";
import { articlesForScope } from "./catalogue";
import { helpHref, type HelpFilters } from "./search";
import type { HelpArticle, HelpScope } from "./types";

export function helpAccess(session: Session, scope: HelpScope) {
  const user = session.user;
  const screens = visibleScreens(user.screens ?? [], expandPermissions(user.permissions ?? []));
  const instructorOnly = screens.has("instructor") && [...screens].every(screen => screen === "instructor");
  return {
    instructorOnly,
    allowed: scope === "desk" ? !instructorOnly : screens.has("instructor"),
    home: scope === "instructor" ? "/instructor" : homePathFor(user.home, user.permissions ?? [], user.screens ?? [], "desk"),
    action(article: HelpArticle): { href: string; label: string } | undefined {
      if (scope === "instructor") return { href: "/instructor", label: "Open classes" };
      if (article.action === "account") return { href: "/account", label: "Open Account" };
      if (!article.action || article.action === "instructor" || !screens.has(article.action)) return undefined;
      const screen = screenMeta(article.action);
      return { href: screen.path, label: `Open ${screen.label}` };
    },
  };
}

/** Each help page authenticates, including direct article and RSC requests. No operational data is loaded. */
export async function helpPage(scope: HelpScope, slug?: string, filters?: HelpFilters) {
  const session = await pageSession();
  const access = helpAccess(session, scope);
  if (scope === "desk" && access.instructorOnly) {
    const available = articlesForScope("instructor").some(article => article.slug === slug);
    redirect(helpHref("instructor", available ? slug : undefined, filters));
  }
  if (!access.allowed) notFound();
  return access;
}
