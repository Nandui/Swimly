import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_GROUPS } from "@/components/core/pages";
import { NAV_ITEMS } from "@/modules/activities/features/workspace/server/nav";
import { academyPages } from "@/modules/academy/features/workspace/pages";
import { cctvPages } from "@/modules/cctv/features/workspace/pages";
import { financePages } from "@/modules/finance-requests/features/workspace/pages";
import { hrPages } from "@/modules/hr/features/workspace/pages";
import { incidentPages } from "@/modules/incidents/features/workspace/pages";
import { maintenancePages } from "@/modules/maintenance/features/workspace/pages";
import { planPages } from "@/modules/plan/features/workspace/pages";
import { purchasingPages } from "@/modules/purchasing/features/workspace/pages";
import { riskPages } from "@/modules/risk/features/workspace/pages";
import { rotaPages } from "@/modules/rota/shared/components/pages";
import { monitoringPages } from "@/modules/site-monitoring/features/workspace/pages";
import { staffingPages } from "@/modules/staffing/features/workspace/pages";
import { stockPages } from "@/modules/stock/features/workspace/pages";
import { tasksPages } from "@/modules/tasks/features/workspace/pages";
import { trainingPages } from "@/modules/training/features/workspace/pages";
import { qualificationsPages } from "@/modules/qualifications/features/workspace/pages";

/** Someone who can do everything in an app: every flag a page list asks about is true. */
const everything = new Proxy({}, { get: (_target, key) => (key === "id" ? "someone" : true) }) as never;

/** Every app's pages as the most capable person sees them. The swim school's Overview is added
 *  by its frame, as it is not in its nav list. */
const APPS: [string, { href: string; label: string; place?: "setup"; under?: string; folderEntry?: string; folder?: { label: string } }[]][] = [
  ["Admin", ADMIN_GROUPS.flatMap((group) => group.links)],
  ["Classes", [{ href: "/swim-school", label: "Overview", folderEntry: "Summary" }, ...NAV_ITEMS]],
  ["Academy", academyPages()],
  ["CCTV log", cctvPages()],
  ["Finance requests", financePages({ id: "someone", refunds: everything, coinage: everything })],
  ["HR", hrPages(everything)],
  ["Incidents", incidentPages(everything)],
  ["Maintenance", maintenancePages()],
  ["Plan (test)", planPages()],
  ["Purchasing", purchasingPages(everything)],
  ["Risk assessments", riskPages({ write: true })],
  ["Rota", rotaPages(true)],
  ["Site Monitoring", monitoringPages()],
  ["Staffing", staffingPages()],
  ["Stock", stockPages()],
  ["Tasks", tasksPages(everything)],
  ["Training", trainingPages(everything)],
  ["Qualifications", qualificationsPages()],
];

test("every app lists at most five work pages in the sidebar, then Set up; nested pages do not count, and a label-only folder counts once (DESIGN.md, D19)", () => {
  for (const [app, pages] of APPS) {
    const work = [...new Set(pages.filter((page) => !page.place && !page.under).map((page) => page.folder?.label ?? page.label))];
    assert.ok(work.length <= 5, `${app} lists ${work.length} work pages in the sidebar: ${work.join(", ")}. Move the rest under Set up or under a work page.`);
  }
});

test("every page nested under another names a page of its own app, and is not also under Set up", () => {
  for (const [app, pages] of APPS) {
    const hrefs = new Set(pages.filter((page) => !page.place).map((page) => page.href));
    for (const page of pages.filter((p) => p.under)) {
      assert.ok(!page.place, `${app}: ${page.label} is both nested and under Set up`);
      assert.ok(!page.folder, `${app}: ${page.label} is both nested under a page and in the ${page.folder?.label} folder`);
      assert.ok(hrefs.has(page.under!), `${app}: ${page.label} nests under ${page.under}, which is not one of its pages`);
    }
  }
});

test("a page with pages under it names itself inside its folder, as its title is not a link (DESIGN.md)", () => {
  for (const [app, pages] of APPS) {
    for (const page of pages.filter((p) => pages.some((s) => s.under === p.href))) {
      assert.ok(page.folderEntry && page.folderEntry !== page.label, `${app}: ${page.label} holds pages, so give it a folderEntry: its own name inside the ${page.label} folder`);
    }
  }
});

test("an app's first work page is its Overview, which lists every page", () => {
  for (const [app, pages] of APPS) {
    if (pages.length < 2) continue;
    assert.equal(pages.find((page) => !page.place)?.label, "Overview", `${app} does not open its sidebar with Overview`);
  }
});
