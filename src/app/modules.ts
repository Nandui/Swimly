import { analyticsModule, poolDeckModule, swimSchoolModule } from "@/modules/activities/manifest";
import { academyModule } from "@/modules/academy/manifest";
import { cctvModule } from "@/modules/cctv/manifest";
import { financeRequestsModule } from "@/modules/finance-requests/manifest";
import { docsModule } from "@/modules/docs/manifest";
import { hrModule } from "@/modules/hr/manifest";
import { incidentsModule } from "@/modules/incidents/manifest";
import { maintenanceModule } from "@/modules/maintenance/manifest";
import { riskModule } from "@/modules/risk/manifest";
import { purchasingModule } from "@/modules/purchasing/manifest";
import { planModule } from "@/modules/plan/manifest";
import { rotaModule } from "@/modules/rota/manifest";
import { siteMonitoringModule } from "@/modules/site-monitoring/manifest";
import { staffingModule } from "@/modules/staffing/manifest";
import { stockModule } from "@/modules/stock/manifest";
import { tasksModule } from "@/modules/tasks/manifest";
import { vouchersModule } from "@/modules/vouchers/manifest";
import { trainingModule } from "@/modules/training/manifest";
import { qualificationsModule } from "@/modules/qualifications/manifest";

/** The one list of Turnfin's modules (AGENTS.md, The app contract). Core's registry
 *  (src/modules/registry.ts) builds menus, the home page and the role editor
 *  from it, adding Admin, which is Core's own. Lists show modules group by
 *  group; within a group, in this order. Each module's server plug, its
 *  module.ts, is loaded by src/modules/server.ts. */
export const modules = [
  swimSchoolModule,
  financeRequestsModule,
  vouchersModule,
  poolDeckModule,
  tasksModule,
  incidentsModule,
  rotaModule,
  planModule,
  staffingModule,
  trainingModule,
  qualificationsModule,
  academyModule,
  docsModule,
  hrModule,
  cctvModule,
  siteMonitoringModule,
  maintenanceModule,
  riskModule,
  analyticsModule,
  purchasingModule,
  stockModule,
];
