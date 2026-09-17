import { CalendarDays, Files, WavesLadder, type LucideIcon } from "lucide-react";
import type { TagColor } from "@/components/ui-kit/tag";

export const PORTAL_BRAND = "Turnfin";
export const PORTAL_NAME = `${PORTAL_BRAND} staff portal`;

export const moduleStatusMeta = {
  available: { label: "Available", color: "green" },
  planned: { label: "Coming soon", color: "gray" },
} satisfies Record<string, { label: string; color: TagColor }>;

type StaffModule = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
} & (
  | { status: "available"; href: string }
  | { status: "planned"; href?: never }
);

/** Add destinations here when each module is ready. Planned modules have no link. */
export const STAFF_MODULES: readonly StaffModule[] = [
  {
    id: "swimly",
    name: "Aquatics",
    description: "Run the swim school. Manage classes, swimmers, attendance and progress.",
    icon: WavesLadder,
    status: "available",
    // Resolve permissions and the preferred workspace again when opened.
    href: "/start",
  },
  {
    id: "docs",
    name: "Docs",
    description: "A home for staff documents and resources.",
    icon: Files,
    status: "planned",
  },
  {
    id: "bookings",
    name: "Bookings",
    description: "Booking tools for the LeisureWorld team.",
    icon: CalendarDays,
    status: "planned",
  },
];
