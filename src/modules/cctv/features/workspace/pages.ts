import { FilePlus2, LayoutDashboard, ScrollText } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** The CCTV log's pages, once: the page bar (CctvShell) and its starter page are built from this
 *  list. A plain module (no "use client"), so a server page can read it. */
export function cctvPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/cctv/overview", label: "Overview", icon: LayoutDashboard, description: "Every CCTV log page", match: (p) => p === "/cctv/overview" },
    { href: "/cctv", label: "Viewings", icon: ScrollText, description: "Every time footage was checked: who, why, what they looked for and what they saw", match: (p) => p === "/cctv" || (p.startsWith("/cctv/") && !/^\/cctv\/(overview|new)(\/|$)/.test(p)) },
    { href: "/cctv/new", label: "Record a viewing", icon: FilePlus2, description: "Straight after you check footage, write down why and what you saw", match: (p) => p.startsWith("/cctv/new") },
  ];
}
