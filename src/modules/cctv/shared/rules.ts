import { z } from "zod";
import { BadgeAlert, Briefcase, Eye, FileQuestion, HandHelping, MessageSquareWarning, PackageX, Scale, ShieldAlert } from "lucide-react";
import type { StatusMeta } from "@/lib/status";
import { isDateOnly } from "@/lib/format";

/** The CCTV log's rules, pure and client-safe: why footage is checked, what an
 *  entry must say and how numbers show. An entry is locked once saved; later facts are notes. */

/** Why footage was checked. The order is the form's. */
export const CCTV_REASONS = ["incident", "complaint", "theft", "safeguarding", "staff", "garda", "claim", "access", "other"] as const;
export type CctvReason = (typeof CCTV_REASONS)[number];

export const CCTV_REASON_META = {
  incident: { label: "An accident or incident", color: "orange", icon: BadgeAlert },
  complaint: { label: "A complaint", color: "blue", icon: MessageSquareWarning },
  theft: { label: "Theft, loss or damage", color: "orange", icon: PackageX },
  safeguarding: { label: "A safeguarding concern", color: "red", icon: ShieldAlert },
  staff: { label: "Staff conduct", color: "purple", icon: Briefcase },
  garda: { label: "A Garda request", color: "blue", icon: HandHelping },
  claim: { label: "An insurance or legal claim", color: "purple", icon: Scale },
  access: { label: "Someone asked for footage of themselves", color: "gray", icon: FileQuestion },
  other: { label: "Something else", color: "gray", icon: Eye },
} satisfies Record<CctvReason, StatusMeta>;

export const reasonMeta = (reason: string): StatusMeta => CCTV_REASON_META[(CCTV_REASONS as readonly string[]).includes(reason) ? (reason as CctvReason) : "other"];

/** Shown as CCTV-00042, like incident reports' INC-00042. */
export const viewingNumber = (n: number) => `CCTV-${String(n).padStart(5, "0")}`;
export const incidentLabel = (n: number) => `INC-${String(n).padStart(5, "0")}`;

/** "INC-00042", "inc 42" or "42" → 42; empty → null; anything else → undefined (not a number). */
export function parseIncidentNumber(raw: string): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  const match = /^(?:inc[\s-]*)?0*(\d{1,9})$/i.exec(text);
  const n = match ? Number(match[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the time as hours and minutes.");
const day = (message: string) => z.string().refine(isDateOnly, message);

export const viewingSchema = z.object({
  siteId: z.string().min(1, "Choose the site whose cameras you checked."),
  viewedOn: day("Choose the day you checked the footage."),
  viewedAt: clock,
  checkedBy: z.string().trim().min(2, "Say who checked the footage.").max(200),
  othersPresent: z.string().trim().max(500).default(""),
  reason: z.enum(CCTV_REASONS, { message: "Choose why the footage was checked." }),
  background: z.string().trim().min(10, "Say what led to the check, in a sentence or two.").max(4000),
  purpose: z.string().trim().min(5, "Say what you were looking for.").max(2000),
  cameras: z.string().trim().min(2, "Say which cameras you watched.").max(500),
  footageOn: day("Choose the day of the footage you watched."),
  footageFrom: clock,
  footageTo: clock,
  findings: z.string().trim().min(5, "Say what you saw, or that nothing relevant was seen.").max(6000),
  copies: z.string().trim().max(1000).default(""),
  incident: z.string().trim().max(20).default(""),
});
export type ViewingInput = z.input<typeof viewingSchema>;
export type ViewingValues = z.output<typeof viewingSchema>;

/** The checks the schema can't make alone, or null when the entry is ready to save. */
export function viewingProblem(v: ViewingValues, today: string): string | null {
  if (v.viewedOn > today) return "The day you checked the footage can't be in the future.";
  if (v.footageOn > v.viewedOn) return "The footage can't be from after the day you watched it.";
  if (v.footageTo <= v.footageFrom) return "The footage's end time must be after its start time.";
  if (parseIncidentNumber(v.incident) === undefined) return "Enter the incident report's number, such as INC-00042, or leave it empty.";
  return null;
}

export const noteSchema = z.string().trim().min(3, "Write what you want to add.").max(2000);
