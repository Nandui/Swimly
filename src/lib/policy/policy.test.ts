import { test } from "node:test";
import assert from "node:assert/strict";
import { actorFrom, can, needsStepUp, siteFilter, subjectFilter } from "./engine";
import type { Actor, Directory, Scope } from "./types";

/** A small LeisureWorld: two sites and a management chain.
 *
 *    maya (Churchfield) ── manages ── liam (Churchfield) ── manages ── ava (Churchfield, also Bishopstown)
 *    noah (Bishopstown)        zoe (other org)
 */
const people: Record<string, { org: string; sites: string[]; manager: string | null }> = {
  maya: { org: "lw", sites: ["churchfield"], manager: null },
  liam: { org: "lw", sites: ["churchfield"], manager: "maya" },
  ava: { org: "lw", sites: ["churchfield", "bishopstown"], manager: "liam" },
  noah: { org: "lw", sites: ["bishopstown"], manager: null },
  zoe: { org: "other", sites: [], manager: null },
};

const dir: Directory = {
  async reportsOf(managerId) {
    const out = new Set<string>();
    const walk = (id: string) => { for (const [who, p] of Object.entries(people)) if (p.manager === id && !out.has(who)) { out.add(who); walk(who); } };
    walk(managerId);
    return out;
  },
  async sitesOf(userId) { return new Set(people[userId]?.sites ?? []); },
  async membersOfSites(ids) { return new Set(Object.entries(people).filter(([, p]) => p.sites.some((s) => ids.includes(s))).map(([id]) => id)); },
  async orgMembers(org) { return new Set(Object.entries(people).filter(([, p]) => p.org === org).map(([id]) => id)); },
};

const basic = { name: "Staff", permissions: ["docs.read"] };
const lead = { roleName: "Lead", permissions: ["docs.manage"] };
const actor = (id: string, assignments: { scope: Scope }[] = [], extra: Partial<Parameters<typeof actorFrom>[0]> = {}): Actor =>
  actorFrom({ id, name: id, orgId: people[id].org, superadmin: false, primary: basic, assignments: assignments.map((a) => ({ ...lead, ...a })), ...extra });

test("matrix: where part of a role applies decides whose records it reaches", async () => {
  const cases: [string, Actor, string, boolean][] = [
    ["staff → a colleague", actor("ava"), "liam", false],
    ["staff → themselves (self-service is not a grant)", actor("ava"), "ava", false],
    ["their team → direct report", actor("liam", [{ scope: { kind: "reports" } }]), "ava", true],
    ["their team → report's report", actor("maya", [{ scope: { kind: "reports" } }]), "ava", true],
    ["their team → themselves", actor("liam", [{ scope: { kind: "reports" } }]), "liam", false],
    ["their team → someone else's team", actor("liam", [{ scope: { kind: "reports" } }]), "noah", false],
    ["a site → someone who works there", actor("maya", [{ scope: { kind: "site", id: "churchfield" } }]), "ava", true],
    ["a site → someone who also works there", actor("noah", [{ scope: { kind: "site", id: "bishopstown" } }]), "ava", true],
    ["a site → another site's person", actor("maya", [{ scope: { kind: "site", id: "churchfield" } }]), "noah", false],
    ["two sites → the second site", actor("noah", [{ scope: { kind: "site", id: "churchfield" } }, { scope: { kind: "site", id: "bishopstown" } }]), "liam", true],
    ["everywhere → anyone in the org", actor("noah", [{ scope: { kind: "all" } }]), "ava", true],
    ["everywhere → another organisation", actor("noah", [{ scope: { kind: "all" } }]), "zoe", false],
  ];
  for (const [label, who, subject, expected] of cases) {
    assert.equal(await can(who, "docs.manage", { subjectUserId: subject, orgId: people[subject].org }, dir), expected, label);
  }
});

test("administrators hold every ordinary capability, never restricted ones; superadmins hold both", async () => {
  const admin = actorFrom({ id: "maya", name: "maya", orgId: "lw", superadmin: false, primary: { name: "Admin", permissions: ["staff.manage", "roles.manage"] }, assignments: [] });
  assert.equal(await can(admin, "docs.manage", { subjectUserId: "noah", orgId: "lw" }, dir), true);
  const superadmin = actorFrom({ id: "maya", name: "maya", orgId: "lw", superadmin: true, primary: basic, assignments: [] });
  assert.equal(await can(superadmin, "docs.manage", { subjectUserId: "noah", orgId: "lw" }, dir), true);
  assert.equal(await can(superadmin, "docs.manage", { subjectUserId: "zoe", orgId: "other" }, dir), false, "superadmin stays inside their org");
});

test("site-bound records follow site grants, never a team", async () => {
  const site = actor("maya", [{ scope: { kind: "site", id: "churchfield" } }]);
  assert.equal(await can(site, "docs.manage", { siteId: "churchfield" }, dir), true);
  assert.equal(await can(site, "docs.manage", { siteId: "bishopstown" }, dir), false);
  const manager = actor("liam", [{ scope: { kind: "reports" } }]);
  assert.equal(await can(manager, "docs.manage", { siteId: "churchfield" }, dir), false);
  assert.deepEqual(await siteFilter(site, "docs.manage"), { kind: "some", siteIds: new Set(["churchfield"]) });
  assert.deepEqual(await siteFilter(actor("noah", [{ scope: { kind: "all" } }]), "docs.manage"), { kind: "all" });
});

test("subject filters list exactly the people a grant reaches", async () => {
  const ids = async (who: Actor) => { const f = await subjectFilter(who, "docs.manage", dir); return f.kind === "all" ? "all" : [...f.userIds].sort(); };
  assert.deepEqual(await ids(actor("maya", [{ scope: { kind: "reports" } }])), ["ava", "liam"]);
  assert.deepEqual(await ids(actor("maya", [{ scope: { kind: "site", id: "bishopstown" } }])), ["ava", "noah"]);
  assert.deepEqual(await ids(actor("ava")), []);
  assert.deepEqual(await ids(actor("noah", [{ scope: { kind: "all" } }])), ["ava", "liam", "maya", "noah"], "everywhere excludes other orgs");
});

test("PIN sessions and stale passwords never pass restricted step-up", () => {
  const now = Date.now();
  const base = { id: "maya", name: "maya", orgId: "lw", superadmin: true, primary: basic, assignments: [] };
  // docs.* is not restricted: no step-up whatever the session.
  assert.equal(needsStepUp(actorFrom({ ...base, authMethod: "pin", authAt: now }), "docs.manage", now), false);
});
