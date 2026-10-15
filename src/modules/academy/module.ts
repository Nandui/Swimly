import "server-only";
import { registerCommitments, registerHomeCard, registerPublicCourses } from "@/modules/contributions";
import { academyPublicCourses } from "@/modules/academy/features/booking";
import { ACADEMY_SESSIONS, academyHomeItems, academySessionCommitments } from "@/modules/academy/features/courses";

/** The Academy's registration plug (CLAUDE.md section 5), loaded by
 *  src/modules/server.ts: course sessions as commitments (the Rota shows them),
 *  the home card, and its courses on the public booking site. Its menu entry,
 *  levels and permissions are in manifest.ts. */
registerCommitments({ id: ACADEMY_SESSIONS, list: academySessionCommitments });
registerHomeCard({ moduleId: "academy", items: academyHomeItems });
registerPublicCourses(academyPublicCourses);
