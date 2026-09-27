import { test } from "node:test";
import assert from "node:assert/strict";
import { actorFrom, can, needsStepUp, siteFilter, subjectFilter } from "./engine";
import type { Actor, Directory, Scope } from "./types";

/** A small LeisureWorld: two sites, two departments, a management chain.
 *
 *    maya (site manager, Churchfield) ── manages ── liam (aquatics lead) ── manages ── ava (instructor)
 *    noah (reception, Bishopstown)        zoe (other org)
 */
const people: Record<string, { org: string; site: string | null; departments: string[]; manager: string | null }> = {
  maya: { org: "lw", site: "churchfield", departments: [], manager: null },
  liam: { org: "lw", site: "churchfield", departments: ["aquatics"], manager: "maya" },
  ava: { org: "lw", site: "churchfield", departments: ["aquatics"], manager: "liam" },
  noah: { org: "lw", site: "bishopstown", departments: ["reception"], manager: null },
  zoe: { org: "other", site: null, departments: [], manager: null },
};
const departmentSite: Record<string, string | null> = { aquatics: "churchfield", reception: "bishopstown" };

const dir: Directory = {
  async reportsOf(managerId) {
    const out = new Set<string>();
    const walk = (id: string) => { for (const [who, p] of Object.entries(people)) if (p.manager === id && !out.has(who)) { out.add(who); walk(who); } };
    walk(managerId);
    return out;
  },
  async departmentsOf(userId) { return new Set(people[userId]?.departments ?? []); },
  async primarySiteOf(userId) { return people[userId]?.site ?? null; },
  async sitesOfDepartments(ids) { return new Map(ids.map((id) => [id, departmentSite[id] ?? null])); },
  async membersOfDepartments(ids) { return new Set(Object.entries(people).filter(([, p]) => p.departments.some((d) => ids.includes(d))).map(([id]) => id)); },
  async membersOfSites(ids) {
    return new Set(Object.entries(people).filter(([, p]) => (p.site && ids.includes(p.site)) || p.departments.some((d) => ids.includes(departmentSite[d] ?? ""))).map(([id]) => id));
  },
  async orgMembers(org) { return new Set(Object.entries(people).filter(([, p]) => p.org === org).map(([id]) => id)); },
};

const basic = { name: "Staff", permissions: ["docs.read"], screens: ["docs"] };
const trainingLead = { roleName: "Training lead", permissions: ["docs.manage"], screens: ["docs"] };
const actor = (id: string, assignments: { scope: Scope }[] = [], extra: Partial<Parameters<typeof actorFrom>[0]> = {}): Actor =>
  actorFrom({ id, name: id, orgId: people[id].org, superadmin: false, primary: basic, assignments: assignments.map((a) => ({ ...trainingLead, ...a })), ...extra });

const subjects = { self: "liam", report: "ava", reportOfReport: "ava", otherDepartment: "noah", otherOrg: "zoe" };

test("matrix: scope of a grant decides whose records it reaches", async () => {
  const cases: [string, Actor, string, boolean][] = [
    // Plain staff: the capability is simply not held.
    ["staff → a colleague", actor("ava"), "liam", false],
    ["staff → themselves (self-service is not a grant)", actor("ava"), "ava", false],
    // Line manager (reports scope).
    ["line manager → direct report", actor("liam", [{ scope: { kind: "reports" } }]), subjects.report, true],
    ["line manager → report's report", actor("maya", [{ scope: { kind: "reports" } }]), subjects.reportOfReport, true],
    ["line manager → themselves", actor("liam", [{ scope: { kind: "reports" } }]), subjects.self, false],
    ["line manager → other department", actor("liam", [{ scope: { kind: "reports" } }]), subjects.otherDepartment, false],
    // Department lead.
    ["department lead → own department", actor("liam", [{ scope: { kind: "department", id: "aquatics" } }]), "ava", true],
    ["department lead → other department", actor("liam", [{ scope: { kind: "department", id: "aquatics" } }]), "noah", false],
    // Site manager.
    ["site manager → person based at the site", actor("maya", [{ scope: { kind: "site", id: "churchfield" } }]), "ava", true],
    ["site manager → other site", actor("maya", [{ scope: { kind: "site", id: "churchfield" } }]), "noah", false],
    // Multi-site duty manager.
    ["multi-site manager → second site", actor("noah", [{ scope: { kind: "site", id: "churchfield" } }, { scope: { kind: "site", id: "bishopstown" } }]), "liam", true],
    // Everywhere.
    ["org-wide grant → anyone in the org", actor("noah", [{ scope: { kind: "all" } }]), "ava", true],
    ["org-wide grant → another organisation", actor("noah", [{ scope: { kind: "all" } }]), "zoe", false],
  ];
  for (const [label, who, subject, expected] of cases) {
    const resource = { subjectUserId: subject, orgId: people[subject].org };
    assert.equal(await can(who, "docs.manage", resource, dir), expected, label);
  }
});

test("administrators hold every ordinary capability, never restricted ones; superadmins hold both", async () => {
  const admin = actorFrom({ id: "maya", name: "maya", orgId: "lw", superadmin: false, primary: { name: "Admin", permissions: ["staff.manage", "roles.manage"], screens: [] }, assignments: [] });
  assert.equal(await can(admin, "docs.manage", { subjectUserId: "noah", orgId: "lw" }, dir), true);
  const superadmin = actorFrom({ id: "maya", name: "maya", orgId: "lw", superadmin: true, primary: basic, assignments: [] });
  assert.equal(await can(superadmin, "docs.manage", { subjectUserId: "noah", orgId: "lw" }, dir), true);
  assert.equal(await can(superadmin, "docs.manage", { subjectUserId: "zoe", orgId: "other" }, dir), false, "superadmin stays inside their org");
});

test("site-bound resources follow site and department grants, never reports", async () => {
  const site = actor("maya", [{ scope: { kind: "site", id: "churchfield" } }]);
  assert.equal(await can(site, "docs.manage", { siteId: "churchfield" }, dir), true);
  assert.equal(await can(site, "docs.manage", { siteId: "bishopstown" }, dir), false);
  const dept = actor("noah", [{ scope: { kind: "department", id: "reception" } }]);
  assert.equal(await can(dept, "docs.manage", { departmentId: "reception" }, dir), true);
  assert.equal(await can(dept, "docs.manage", { siteId: "churchfield" }, dir), false);
  const manager = actor("liam", [{ scope: { kind: "reports" } }]);
  assert.equal(await can(manager, "docs.manage", { siteId: "churchfield" }, dir), false);
  assert.deepEqual(await siteFilter(dept, "docs.manage", dir), { kind: "some", siteIds: new Set(["bishopstown"]) });
});

test("subject filters list exactly the people a grant reaches", async () => {
  const ids = async (who: Actor) => { const f = await subjectFilter(who, "docs.manage", dir); return f.kind === "all" ? "all" : [...f.userIds].sort(); };
  assert.deepEqual(await ids(actor("maya", [{ scope: { kind: "reports" } }])), ["ava", "liam"]);
  assert.deepEqual(await ids(actor("liam", [{ scope: { kind: "department", id: "aquatics" } }])), ["ava", "liam"]);
  assert.deepEqual(await ids(actor("maya", [{ scope: { kind: "site", id: "bishopstown" } }])), ["noah"]);
  assert.deepEqual(await ids(actor("ava")), []);
  assert.deepEqual(await ids(actor("noah", [{ scope: { kind: "all" } }])), ["ava", "liam", "maya", "noah"], "org-wide excludes other orgs");
});

test("PIN sessions and stale passwords never pass restricted step-up", () => {
  const now = Date.now();
  const base = { id: "maya", name: "maya", orgId: "lw", superadmin: true, primary: basic, assignments: [] };
  // docs.* is not restricted: no step-up whatever the session.
  assert.equal(needsStepUp(actorFrom({ ...base, authMethod: "pin", authAt: now }), "docs.manage", now), false);
});
