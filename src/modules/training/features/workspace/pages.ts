import { BookOpen, ClipboardCheck, FileBadge, Hourglass, LayoutDashboard, Users } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { TrainingActor } from "@/modules/training/shared/access";

/** Training's pages, once: the page bar (TrainingShell) and its starter page are built from this
 *  list. Each appears only for the job the person has; the pages enforce it again and scope
 *  records. A plain module (no "use client"), so a server page can read it. */
export function trainingPages(who: Pick<TrainingActor, "signoff" | "qualifications">): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/training/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Training page", match: (p) => p === "/training/overview" },
    { href: "/training", label: "People", icon: Users, description: "Training for the people you cover: what is due, waiting for sign-off and done", match: (p) => p === "/training" || p.startsWith("/training/people/") },
    ...(who.signoff ? [{ href: "/training/sign-off", label: "Sign-off", icon: ClipboardCheck, description: "People who say they are ready, to watch and sign off", match: (p: string) => p === "/training/sign-off" }] : []),
    { href: "/training/expiring", label: "Expiring qualifications", icon: Hourglass, description: "Qualifications that run out soon, for the people you cover", match: (p) => p === "/training/expiring" },
    ...(who.qualifications ? [{ href: "/training/certificates", label: "Certificates to check", icon: FileBadge, description: "Certificates uploaded in Turnfin Me, to check and record", match: (p: string) => p.startsWith("/training/certificates") }] : []),
    { href: "/training/courses", label: "Courses", icon: BookOpen, description: "The courses staff are assigned and complete", match: (p) => p.startsWith("/training/courses") },
  ];
}
