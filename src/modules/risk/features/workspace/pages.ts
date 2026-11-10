import { CalendarClock, FilePlus2, LayoutDashboard, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Risk assessments' pages, once: the sidebar (RiskShell) and its starter page are built from this
 *  list. Starting an assessment is only for those who write; the page checks too. */
export function riskPages(who: { write: boolean }): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/risk-assessments/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Risk assessments page", match: (p) => p === "/risk-assessments/overview" },
    { href: "/risk-assessments", label: "Assessments", icon: ShieldCheck, description: "Every assessment at your sites: in force, waiting for sign-off, drafts and archived", match: (p) => p === "/risk-assessments" || /^\/risk-assessments\/(?!new$|overview$|reviews$|high-risk$)/.test(p) },
    { href: "/risk-assessments/reviews", label: "Reviews", icon: CalendarClock, description: "Review requests to answer, and the reviews that are overdue or due soon", match: (p) => p === "/risk-assessments/reviews" },
    { href: "/risk-assessments/high-risk", label: "High risk", icon: TriangleAlert, description: "Hazards still rated High or Very high with their controls in place", match: (p) => p === "/risk-assessments/high-risk" },
    ...(who.write ? [{ href: "/risk-assessments/new", label: "Start an assessment", icon: FilePlus2, description: "A new draft for an area, a job or an activity at one of your sites", match: (p: string) => p === "/risk-assessments/new" }] : []),
  ];
}
