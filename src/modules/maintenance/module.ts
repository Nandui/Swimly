import "server-only";
import { registerAreaRename, registerHomeCard, registerSubjectRecords } from "@/modules/contributions";
import { maintenanceHomeItems } from "@/modules/maintenance/features/requests/server/home";
import { maintenanceSubjectRecords, renameMaintenanceAreas } from "@/modules/maintenance/features/requests/server/people";

/** Maintenance's registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts:
 *  the home card, the requests a person reported for HR's subject export, and area renames. Its
 *  menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "maintenance", items: maintenanceHomeItems });
registerSubjectRecords({ key: "maintenance", load: maintenanceSubjectRecords });
registerAreaRename({ id: "maintenance.areas", rename: renameMaintenanceAreas });
