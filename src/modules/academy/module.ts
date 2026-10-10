import "server-only";
import { registerCommitments, registerHomeCard } from "@/modules/contributions";
import { ACADEMY_SESSIONS, academyHomeItems, academySessionCommitments } from "@/modules/academy/features/courses";

/** The Academy's registration plug (CLAUDE.md section 5), loaded by
 *  src/modules/server.ts: course sessions as commitments (the Rota shows them)
 *  and the home card. Its menu entry, levels and permissions are in manifest.ts. */
registerCommitments({ id: ACADEMY_SESSIONS, list: academySessionCommitments });
registerHomeCard({ moduleId: "academy", items: academyHomeItems });
