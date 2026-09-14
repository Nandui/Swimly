import type { ScreenKey } from "@/lib/staff/screens";
import type { HelpScreenshot } from "./screenshots";

export type HelpScope = "desk" | "instructor";
export const HELP_CATEGORIES = [
  { id: "start", title: "Getting started", description: "Find your way around, choose a site and understand access." },
  { id: "swimmers", title: "Swimmers", description: "Find records, update details and follow a swimmer’s progress." },
  { id: "enrolment", title: "Enrolment & moves", description: "Find a place, move classes, manage waitlists and sibling times." },
  { id: "classes", title: "Classes & schedule", description: "Browse the timetable, inspect classes and plan the day." },
  { id: "teaching", title: "Attendance & progress", description: "Start teaching, take attendance and record competencies." },
  { id: "assessments", title: "Assessments", description: "Create sessions, book swimmers and record placements." },
  { id: "operations", title: "Daily operations", description: "Cancel a session, follow up with billing and read analytics." },
  { id: "setup", title: "Administration", description: "Manage the curriculum, staff, permissions and sites." },
  { id: "support", title: "Account & troubleshooting", description: "Change appearance, recover from errors and get help." },
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number]["id"];
export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  scopes: HelpScope[];
  keywords: string[];
  before: string[];
  steps: { title: string; text: string; scopes?: HelpScope[]; screenshots?: HelpScreenshot[] }[];
  result: string;
  troubleshooting: { question: string; answer: string }[];
  related: string[];
  action?: ScreenKey | "account";
};
