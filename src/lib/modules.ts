import { CalendarDays, Files, ReceiptText, WavesLadder, type LucideIcon } from "lucide-react";
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
  /** Opt in only modules relevant to reception staff. */
  reception?: boolean;
} & (
  | { status: "available"; href: string }
  | { status: "planned"; href?: never }
);

/** Add destinations here when each module is ready. Planned modules have no link. */
export const STAFF_MODULES: readonly StaffModule[] = [
  { id: "refunds", reception: true, name: "Refunds", description: "Submit customer refund requests, follow finance decisions and record completed payments.", icon: ReceiptText, status: "available", href: "/refunds" },
  {
    id: "swimly",
    reception: true,
    name: "Aquatics",
    description: "Run the swim school. Manage classes, swimmers, attendance and progress.",
    icon: WavesLadder,
    status: "available",
    // Resolve permissions and the preferred workspace again when opened.
    href: "/start",
  },
  {
    id: "docs",
    reception: true,
    name: "Docs",
    description: "Read, write and approve staff documents. Track required reading.",
    icon: Files,
    status: "available",
    href: "/docs",
  },
  {
    id: "bookings",
    reception: true,
    name: "Bookings",
    description: "Booking tools for the LeisureWorld team.",
    icon: CalendarDays,
    status: "planned",
  },
];
