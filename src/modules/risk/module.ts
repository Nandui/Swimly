import "server-only";
import { on } from "@/platform/events";
import { registerAreaRename, registerHazardRegister, registerHomeCard, registerSubjectRecords } from "@/modules/contributions";
import { renameRiskAreas, riskSubjectRecords } from "@/modules/risk/features/assessments/server/people";
import { hazardsByIds, searchHazards } from "@/modules/risk/features/hazards/server/register";
import { raiseFromIncident } from "@/modules/risk/features/reviews/server/from-incident";
import { riskHomeItems } from "@/modules/risk/features/reviews/server/home";

/** The registration plug of Risk assessments (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts: the home card, what it holds about a person for the subject export in
 *  HR, area renames, the site's assessed hazards for other apps, and the event that raises a
 *  review request from an incident. Its menu entry, levels and permissions are in manifest.ts.
 *  A module reloaded in development stops its old listener first, so it never listens twice. */
const plug = globalThis as { riskStop?: () => void };
registerHomeCard({ moduleId: "risk", items: riskHomeItems });
registerSubjectRecords({ key: "risk", load: riskSubjectRecords });
registerAreaRename({ id: "risk.areas", rename: renameRiskAreas });
registerHazardRegister({ app: "risk", search: searchHazards, byIds: hazardsByIds });
plug.riskStop?.();
plug.riskStop = on("incidents.hazards.flagged", async (event) => { await raiseFromIncident(event); }, { app: "risk" });
