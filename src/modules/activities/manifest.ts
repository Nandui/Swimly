import { ChartNoAxesCombined, Waves, WavesLadder } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/apps.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const swimSchoolModule: ModuleManifest = {
  id: "swim-school",
  group: "front-of-house",
  // Shown as Classes since D24 (3 November 2026): gym activities may follow, so the name is not
  // about swimming. The id stays (stored roles and switches); the log name stays Swim school so
  // the activity log reads on. Swim school is the first activity type (src/modules/activities/shared/types.ts).
  name: "Classes",
  description: "Swimmers, classes, short courses and assessments at the desk, and their set-up",
  icon: WavesLadder,
  href: "/swim-school",
  logName: "Swim school",
  access: {
    reach: "sites",
    levels: [
      {
        key: "desk", label: "Desk", help: "Every swimmer, booking, move, waitlist and assessment booking, booking people on short courses, and following up failed payments.",
        permissions: ["swimschool.desk", "students.manage", "enrolment.manage", "parents.manage", "payments.read", "payments.follow", "short-courses.read"],
      },
      {
        key: "manage", label: "Manage", help: "Programmes, levels and classes, the short course list and putting short courses on, and uploading the bank's failed payments sheet.",
        permissions: ["courses.manage", "curriculum.manage", "progression.override", "payments.manage", "short-courses.manage"],
      },
    ],
    extras: [
      {
        key: "cancel-classes", label: "Can cancel classes", help: "Cancel today's sessions on the duty manager page and pass them to billing.", from: "desk",
        permissions: ["classes.cancel", "billing.notify"],
      },
    ],
    // Short courses joined (D24, owner default 3 November 2026): their View is Desk and their
    // Manage is Manage here; their Instructor is Pool deck Teach.
    formerly: [{ id: "short-courses", levels: { view: "desk", manage: "manage" } }],
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
        key: "teach", label: "Teach", help: "Their own classes: attendance, competencies, assessments, and covering a colleague's class. Short courses at their sites, and their registers.",
        permissions: ["attendance.mark", "attendance.cover", "progression.assess", "progression.complete", "assessments.run", "short-courses.run"],
      },
      {
        key: "lead", label: "Lead", help: "Also take attendance for any class, for example copying in a paper register.",
        permissions: ["attendance.markAny"],
      },
    ],
    // Short courses' Instructor teaches on the pool deck now (D24).
    formerly: [{ id: "short-courses", levels: { run: "teach" } }],
  },
};

// Analytics is for managers only (owner decision, 21 October 2026: "the whole analytics page
// should only be accessible to managers and above"), so it is its own module in the Managers
// group rather than part of Swim school Manage. Its pages stay in the swim school workspace.
export const analyticsModule: ModuleManifest = {
  id: "analytics",
  group: "managers",
  name: "Analytics",
  description: "The swim school's Business, Reception and Pool deck dashboards",
  icon: ChartNoAxesCombined,
  href: "/analytics",
  logName: "Analytics",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the Business, Reception and Pool deck dashboards for their sites, and every report behind them.", permissions: ["analytics.view"] },
    ],
  },
};
