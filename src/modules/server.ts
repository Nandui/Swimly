import "server-only";
// Loads every module's server-side contributions, so Core pages can import this file instead
// of any module directly.
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
import "@/modules/vouchers/module";
import "@/modules/staffing/module";
import "@/modules/cctv/module";
import "@/modules/site-monitoring/module";
import "@/modules/maintenance/module";
import "@/modules/risk/module";
import "@/lib/people/home";
import "@/modules/hr/module";

export { renameAreaEverywhere, homeCardItems, searchApps, siteSummaryLines } from "./contributions";
