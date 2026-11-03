import "server-only";
// The composition root for server-side module contributions: the one place
// allowed to import every module, so Core pages can import this file instead
// of any module directly (see the import boundaries in eslint.config.mjs).
import "@/modules/activities/module";
import "@/modules/finance-requests/module";
import "@/modules/docs/module";
import "@/modules/training/module";
import "@/modules/qualifications/module";
import "@/modules/rota/module";
import "@/modules/plan/module";
import "@/modules/purchasing/module";
import "@/modules/incidents/module";
import "@/modules/tasks/module";
import "@/modules/academy/module";
import "@/modules/stock/module";
import "@/modules/cctv/module";
import "@/modules/site-monitoring/module";
import "@/modules/maintenance/module";
import "@/lib/people/home";
import "@/modules/hr/module";

export { renameAreaEverywhere, homeCardItems, searchApps, siteSummaryLines } from "./contributions";
