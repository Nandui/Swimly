import "server-only";
import { registerAreaRename, registerCommitments, registerHomeCard } from "@/modules/contributions";
import { renameShortCoursePlaces, SHORT_COURSE_SESSIONS, shortCourseCommitments, shortCourseHomeItems } from "@/modules/short-courses/features/courses";

/** Short courses' registration plug (CLAUDE.md section 5), loaded by src/modules/server.ts:
 *  course sessions as commitments (the Rota shows them), area renames and the home card. Its
 *  menu entry, levels and permissions are in manifest.ts. */
registerCommitments({ id: SHORT_COURSE_SESSIONS, list: shortCourseCommitments });
registerAreaRename({ id: "short-courses.places", rename: renameShortCoursePlaces });
registerHomeCard({ moduleId: "short-courses", items: shortCourseHomeItems });
