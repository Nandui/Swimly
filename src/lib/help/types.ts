import type { ScreenKey } from "@/lib/staff/screens";
import type { HelpScreenshot } from "./screenshots";

export type HelpScope = "desk" | "instructor";
export const HELP_CATEGORIES = [
  { id: "start", title: "Getting started", description: "Find your way around, choose a site and understand access." },
  { id: "home", title: "Home and Turnfin Me", description: "Read the home page and find your own training, shifts and HR on your phone." },
  { id: "swimmers", title: "Swimmers", description: "Find records, update details and follow a swimmer’s progress." },
  { id: "enrolment", title: "Enrolment and moves", description: "Find a place, move classes, manage waitlists and sibling times." },
  { id: "classes", title: "Classes and schedule", description: "Browse the timetable, inspect classes and plan the day." },
  { id: "teaching", title: "Attendance and progress", description: "Start teaching, take attendance and record competencies." },
  { id: "assessments", title: "Assessments", description: "Create sessions, book swimmers and record placements." },
  { id: "operations", title: "Daily operations", description: "Cancel a session, follow up with billing and read analytics." },
  { id: "refunds", title: "Refunds", description: "Log a customer’s refund request and decide it in finance." },
  { id: "docs", title: "Docs", description: "Find and read staff documents, write them and send them for approval." },
  { id: "training", title: "Training", description: "Assign training and sign off what people show you in person." },
  { id: "rota", title: "Rota", description: "Plan the week’s shifts and report an absence." },
  { id: "tasks", title: "Tasks", description: "Do the day’s checks and logs, follow up what is out of range and write the templates." },
  { id: "hr", title: "HR", description: "Keep notes and run performance reviews for the people you look after." },
  { id: "setup", title: "Administration", description: "Manage the curriculum, staff, roles and sites." },
  { id: "support", title: "Account and troubleshooting", description: "Change appearance, recover from errors and get help." },
] as const;
/** The module a topic belongs to, as the screen that opens it: Help shows these topics only to
 *  people who can open that screen (Task links respect screen access, DESIGN.md). */
export const HELP_CATEGORY_SCREENS: Partial<Record<(typeof HELP_CATEGORIES)[number]["id"], ScreenKey>> = {
  refunds: "refunds", docs: "docs", training: "training", rota: "rota", hr: "hr", tasks: "tasks",
};
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
