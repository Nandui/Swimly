import "server-only";
import { registerHomeCard, registerPersonFileSection, registerSubjectRecords } from "@/modules/contributions";
import { incidentHomeItems } from "@/modules/incidents/features/reports/server/home";
import { staffIncidentFile, staffIncidentRecords } from "@/modules/incidents/features/staff/server/file";

/** Incidents' registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "incidents", items: incidentHomeItems });
registerPersonFileSection({ id: "incidents.involved", heading: "Incidents and injuries at work", load: staffIncidentFile });
registerSubjectRecords({ key: "incidents", load: staffIncidentRecords });
