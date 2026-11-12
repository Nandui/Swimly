import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession, mayFor, sitesFor } from "@/lib/policy/session";
import { RiskError } from "@/modules/risk/shared/rules";

/** Who may open Risk assessments: anyone who may read them at some site. An assessment belongs to
 *  a site, so every list limits itself to the sites `risk.read` covers (`sitesFor`), and each
 *  change checks its permission at the assessment's site (`mayFor`). Drafts are for writers. */
export type RiskActor = { id: string; name: string; orgId: string | null; superadmin: boolean; write: boolean; manage: boolean; signoff: boolean };

export function riskAccess(session: Session): RiskActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "risk.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    write: holdsAnywhere(actor, "risk.write"), manage: holdsAnywhere(actor, "risk.manage"), signoff: holdsAnywhere(actor, "risk.signoff"),
  };
}

export async function requireRiskActor() {
  const who = riskAccess(await requireSession());
  if (!who) throw new AuthorizationError("Risk assessments access is required.");
  return who;
}

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
/** A where-clause for the sites a grant covers. */
export const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
export const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);

/** What this person holds at one site. A draft is seen only with Write there. */
export async function accessAt(who: RiskActor, siteId: string) {
  const at = { siteId, orgId: who.orgId };
  const [read, write, manage, signoff] = await Promise.all([mayFor("risk.read", at), mayFor("risk.write", at), mayFor("risk.manage", at), mayFor("risk.signoff", at)]);
  return { read, write, manage, signoff };
}
export const maySee = (at: { read: boolean; write: boolean }, status: string) => at.read && (status !== "draft" || at.write);

/** Refuses, in the person's words, unless they hold `permission` at the assessment's site. An
 *  assessment they may not see answers as one that is not there. */
export async function requireAt(who: RiskActor, row: { siteId: string; status: string } | null, permission: "risk.read" | "risk.write" | "risk.manage" | "risk.signoff") {
  const at = row ? await accessAt(who, row.siteId) : null;
  if (!row || !at || !maySee(at, row.status)) throw new RiskError("This assessment is not available.");
  const held = { "risk.read": at.read, "risk.write": at.write, "risk.manage": at.manage, "risk.signoff": at.signoff }[permission];
  if (!held) throw new RiskError(NEEDS[permission]);
  return at;
}
const NEEDS = {
  "risk.read": "This assessment is not available.",
  "risk.write": "Changing assessments needs Risk assessments: Write at this site.",
  "risk.manage": "Archiving needs Risk assessments: Manage at this site.",
  "risk.signoff": "The executive sign-off needs its tick on your role, at this site.",
} as const;
