import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, registerPersonFileSection, registerQualificationRenewals, registerSubjectRecords, type HomeItem } from "@/modules/contributions";
import { assignTraining } from "@/modules/training/features/assignments/server/actions";
import { renewalCourses } from "@/modules/training/features/assignments/server/renewal";
import { trainingFile, trainingLearnerRecords, trainingOnTheJobRecords, trainingRecords } from "@/modules/training/features/person-file/server/file";
import { registersToClose } from "@/modules/training/features/sessions/server/data";
import { signoffCount } from "@/modules/training/features/sign-off/server/data";

/** Training's registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts: its home card, its part of a person's file, its
 *  records for HR's subject export and the course that renews a qualification. Its menu entry, levels and permissions are in manifest.ts. */

registerPersonFileSection({ id: "training.open", app: "training", heading: "Training", load: trainingFile });
registerSubjectRecords({ key: "training", load: trainingRecords });
registerSubjectRecords({ key: "trainingOnTheJob", load: trainingOnTheJobRecords });
registerSubjectRecords({ key: "trainingLearner", load: trainingLearnerRecords });

/** The course that renews a qualification, for Qualifications' expiring list (D26). Assigning goes
 *  through Training's own assign, which checks `training.assign` for the person. */
registerQualificationRenewals({ app: "training", find: renewalCourses, assign: (courseId, userId, dueOn) => assignTraining(courseId, [userId], dueOn) });

/** Training on the home page, for trainers and training managers. Everyone
 *  completes their own training in Turnfin Me. */
registerHomeCard({
  moduleId: "training",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    const items: HomeItem[] = [];
    if (held.has("training.signoff")) {
      const waiting = await signoffCount();
      items.push({ label: "Practical sign-offs", hint: "Confirm skills shown in person", href: "/training/sign-off", count: waiting, attention: waiting > 0 });
      const registers = await registersToClose();
      if (registers) items.push({ label: "Registers to close", hint: "Sessions that have started", href: "/training/sessions", count: registers, attention: true });
    }
    return items;
  },
});
