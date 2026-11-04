import { Award, CalendarX, CircleCheck, Clock3, EyeOff, FolderLock, Gauge, MessageSquareWarning, Pencil, Share2, ShieldAlert, StickyNote } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Who can read a note. Tone and icon come from here, never a call site. */
export const NOTE_VISIBILITY_META = {
  private: { label: "Only me", color: "gray", icon: EyeOff, hint: "Only you (and a superadmin) can read it." },
  record: { label: "On their record", color: "blue", icon: FolderLock, hint: "Anyone who can read this person's HR record." },
  subject: { label: "Shared with them", color: "green", icon: Share2, hint: "Also shown to the person in Turnfin Me." },
} as const satisfies Record<string, StatusMeta & { hint: string }>;
export type NoteVisibility = keyof typeof NOTE_VISIBILITY_META;
export const NOTE_VISIBILITIES = Object.keys(NOTE_VISIBILITY_META) as NoteVisibility[];

/** What a note is about (D22). Neutral tones: a kind sorts the file, it is never an alarm.
 *  Good work is the positive kind, so it reads green. */
export const NOTE_KIND_META = {
  general: { label: "General", color: "gray", icon: StickyNote },
  conduct: { label: "Conduct", color: "gray", icon: MessageSquareWarning },
  performance: { label: "Performance", color: "gray", icon: Gauge },
  attendance: { label: "Attendance", color: "gray", icon: CalendarX },
  safety: { label: "Safety", color: "gray", icon: ShieldAlert },
  good_work: { label: "Good work", color: "green", icon: Award },
} as const satisfies Record<string, StatusMeta>;
export type NoteKind = keyof typeof NOTE_KIND_META;
export const NOTE_KINDS = Object.keys(NOTE_KIND_META) as NoteKind[];
/** The kinds a report can be: every kind but General, Good work first. */
export const REPORT_KINDS: readonly NoteKind[] = ["good_work", ...NOTE_KINDS.filter((k) => k !== "general" && k !== "good_work")];

export const REVIEW_STATUS_META = {
  draft: { label: "Draft", color: "gray", icon: Pencil },
  shared: { label: "Awaiting acknowledgement", color: "orange", icon: Clock3 },
  acknowledged: { label: "Acknowledged", color: "green", icon: CircleCheck },
} as const satisfies Record<string, StatusMeta>;
export type ReviewStatus = keyof typeof REVIEW_STATUS_META;

/** The overall assessment is words, not a colour: none of these is an alarm. */
export const REVIEW_OVERALL_LABELS = {
  exceeds: "Exceeds expectations",
  meets: "Meets expectations",
  developing: "Still developing",
} as const;
export type ReviewOverall = keyof typeof REVIEW_OVERALL_LABELS;
