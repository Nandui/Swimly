import { academyModule } from "@/modules/academy/manifest";
import { poolDeckModule, swimSchoolModule } from "@/modules/activities/manifest";
import { docsModule } from "@/modules/docs/manifest";
import { hrModule } from "@/modules/hr/manifest";
import { purchasingModule } from "@/modules/purchasing/manifest";
import { refundsModule } from "@/modules/refunds/manifest";
import { rotaModule } from "@/modules/rota/manifest";
import { tasksModule } from "@/modules/tasks/manifest";
import { trainingModule } from "@/modules/training/manifest";

/** The one list of Turnfin's modules (CLAUDE.md, section 5). Core's registry
 *  (src/modules/registry.ts) builds menus, the home page and the role editor
 *  from it, adding Admin, which is Core's own. Lists show modules group by
 *  group; within a group, in this order. Each module's server plug, its
 *  module.ts, is loaded by src/modules/server.ts. */
export const modules = [
  swimSchoolModule,
  academyModule,
  refundsModule,
  poolDeckModule,
  tasksModule,
  rotaModule,
  trainingModule,
  docsModule,
  hrModule,
  purchasingModule,
];
