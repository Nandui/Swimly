import { analyticsModule, poolDeckModule, swimSchoolModule } from "@/modules/activities/manifest";
import { cctvModule } from "@/modules/cctv/manifest";
import { coinageModule } from "@/modules/coinage/manifest";
import { docsModule } from "@/modules/docs/manifest";
import { hrModule } from "@/modules/hr/manifest";
import { incidentsModule } from "@/modules/incidents/manifest";
import { maintenanceModule } from "@/modules/maintenance/manifest";
import { purchasingModule } from "@/modules/purchasing/manifest";
import { refundsModule } from "@/modules/refunds/manifest";
import { rotaModule } from "@/modules/rota/manifest";
import { siteMonitoringModule } from "@/modules/site-monitoring/manifest";
import { shortCoursesModule } from "@/modules/short-courses/manifest";
import { stockModule } from "@/modules/stock/manifest";
import { tasksModule } from "@/modules/tasks/manifest";
import { trainingModule } from "@/modules/training/manifest";

/** The one list of Turnfin's modules (AGENTS.md, The app contract). Core's registry
 *  (src/modules/registry.ts) builds menus, the home page and the role editor
 *  from it, adding Admin, which is Core's own. Lists show modules group by
 *  group; within a group, in this order. Each module's server plug, its
 *  module.ts, is loaded by src/modules/server.ts. */
export const modules = [
  swimSchoolModule,
  shortCoursesModule,
  refundsModule,
  coinageModule,
  poolDeckModule,
  tasksModule,
  incidentsModule,
  rotaModule,
  trainingModule,
  docsModule,
  hrModule,
  cctvModule,
  siteMonitoringModule,
  maintenanceModule,
  analyticsModule,
  purchasingModule,
  stockModule,
];
