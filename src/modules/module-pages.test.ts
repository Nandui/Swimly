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
import { rotaPages } from "@/modules/rota/shared/components/pages";
import { monitoringPages } from "@/modules/site-monitoring/features/workspace/pages";
import { stockPages } from "@/modules/stock/features/workspace/pages";
import { tasksPages } from "@/modules/tasks/features/workspace/pages";
import { trainingPages } from "@/modules/training/features/workspace/pages";
import { qualificationsPages } from "@/modules/qualifications/features/workspace/pages";

/** Someone who can do everything in an app: every flag a page list asks about is true. */
const everything = new Proxy({}, { get: (_target, key) => (key === "id" ? "someone" : true) }) as never;

/** Every app's pages as the most capable person sees them. The swim school's Overview is added
 *  by its frame, as it is not in its nav list. */
const APPS: [string, { label: string; place?: "setup" | "overview"; under?: string }[]][] = [
  ["Admin", ADMIN_GROUPS.flatMap((group) => group.links)],
  ["Classes", [{ label: "Overview" }, ...NAV_ITEMS]],
  ["Academy", academyPages()],
  ["CCTV log", cctvPages()],
  ["Finance requests", financePages({ id: "someone", refunds: everything, coinage: everything })],
  ["HR", hrPages(everything)],
  ["Incidents", incidentPages(everything)],
  ["Maintenance", maintenancePages()],
  ["Plan (test)", planPages()],
  ["Purchasing", purchasingPages(everything)],
  ["Rota", rotaPages(true)],
  ["Site Monitoring", monitoringPages()],
  ["Stock", stockPages()],
  ["Tasks", tasksPages(everything)],
  ["Training", trainingPages(everything)],
  ["Qualifications", qualificationsPages()],
];

test("every app lists at most five work pages in the sidebar, then Set up; nested pages do not count (DESIGN.md, D19)", () => {
  for (const [app, pages] of APPS) {
    const work = pages.filter((page) => !page.place && !page.under).map((page) => page.label);
    assert.ok(work.length <= 5, `${app} lists ${work.length} work pages in the sidebar: ${work.join(", ")}. Move the rest under Set up or onto its Overview.`);
  }
});

test("an app's first work page is its Overview, which lists every page", () => {
  for (const [app, pages] of APPS) {
    if (pages.length < 2) continue;
    assert.equal(pages.find((page) => !page.place)?.label, "Overview", `${app} does not open its sidebar with Overview`);
  }
});
