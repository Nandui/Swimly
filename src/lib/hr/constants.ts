import type { StatusMeta } from "@/lib/status";

/** Who can read a note. Tones come from here, never a call site; each also
 *  has its own icon in `NoteVisibilityTag`. */
export const NOTE_VISIBILITY_META = {
  private: { label: "Only me", color: "gray", hint: "Only you (and a superadmin) can read it." },
  record: { label: "On their record", color: "blue", hint: "Anyone who can read this person's HR record." },
  subject: { label: "Shared with them", color: "green", hint: "Also shown to the person in Turnfin Me." },
} as const satisfies Record<string, StatusMeta & { hint: string }>;
export type NoteVisibility = keyof typeof NOTE_VISIBILITY_META;
export const NOTE_VISIBILITIES = Object.keys(NOTE_VISIBILITY_META) as NoteVisibility[];

export const REVIEW_STATUS_META = {
  draft: { label: "Draft", color: "gray" },
  shared: { label: "Awaiting acknowledgement", color: "orange" },
  acknowledged: { label: "Acknowledged", color: "green" },
} as const satisfies Record<string, StatusMeta>;
export type ReviewStatus = keyof typeof REVIEW_STATUS_META;

/** The overall assessment is words, not a colour: none of these is an alarm. */
export const REVIEW_OVERALL_LABELS = {
  exceeds: "Exceeds expectations",
  meets: "Meets expectations",
  developing: "Still developing",
} as const;
export type ReviewOverall = keyof typeof REVIEW_OVERALL_LABELS;
