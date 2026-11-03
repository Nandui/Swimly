import "server-only";
import { registerCommitments, registerDeskMeasures, registerHomeCard, registerMemberHistory } from "@/modules/contributions";
import { academyCallBacks } from "@/modules/academy/features/calls/server/desk-measures";
import { ACADEMY_SESSIONS, academyHomeItems, academyMemberHistory, academySessionCommitments } from "@/modules/academy/features/courses/server/contributions";

/** The Academy's registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts:
 *  its sessions as commitments (the Rota shows them), the home card, its call backs for the swim
 *  school's reception analytics, and the courses each member of the public has been on for their
 *  swimmer profile. Its menu entry, levels and permissions are in manifest.ts. */
registerCommitments({ id: ACADEMY_SESSIONS, app: "academy", list: academySessionCommitments });
registerHomeCard({ moduleId: "academy", items: academyHomeItems });
registerDeskMeasures({ id: "academy.calls", app: "academy", list: academyCallBacks });
registerMemberHistory({ id: "academy.candidates", app: "academy", list: academyMemberHistory });
