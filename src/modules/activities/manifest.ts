import { Waves, WavesLadder } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const swimSchoolModule: ModuleManifest = {
  id: "swim-school",
  group: "front-of-house",
  name: "Swim school",
  // Swim school is the first activity type (see src/modules/activities/shared/types.ts).
  description: "Swimmers, classes and assessments at the desk, and the swim school's set-up",
  icon: WavesLadder,
  href: "/swim-school",
  logName: "Swim school",
  access: {
    reach: "sites",
    levels: [
      {
        key: "desk", label: "Desk", help: "Every swimmer, booking, move, waitlist and assessment booking.",
        permissions: ["swimschool.desk", "students.manage", "enrolment.manage", "parents.manage"],
      },
      {
        key: "manage", label: "Manage", help: "Programmes, levels, classes and reports.",
        permissions: ["courses.manage", "curriculum.manage", "progression.override"],
      },
    ],
    extras: [
      {
        key: "cancel-classes", label: "Can cancel classes", help: "Cancel today's sessions on the duty manager page and pass them to billing.", from: "desk",
        permissions: ["classes.cancel", "billing.notify"],
      },
    ],
  },
};

// The pool deck is its own module: teaching is a different job from the desk
// (owner decision, 28 September 2026). Swim teachers see the class instructor
// view and nothing else; receptionists never see it unless given it too.
export const poolDeckModule: ModuleManifest = {
  id: "pool-deck",
  group: "poolside",
  name: "Pool deck",
  description: "Today's classes at the pool: attendance, competencies and assessments",
  icon: Waves,
  href: "/instructor",
  logName: "Swim school",
  access: {
    reach: "sites",
    levels: [
      {
        key: "teach", label: "Teach", help: "Their own classes: attendance, competencies, assessments, and covering a colleague's class.",
        permissions: ["attendance.mark", "attendance.cover", "progression.assess", "progression.complete", "assessments.run"],
      },
      {
        key: "lead", label: "Lead", help: "Also take attendance for any class, for example copying in a paper register.",
        permissions: ["attendance.markAny"],
      },
    ],
  },
};
