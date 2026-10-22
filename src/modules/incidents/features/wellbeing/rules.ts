import { z } from "zod";

/** The pure rules for asking HR from a report (docs/incidents.md, "Asking HR"):
 *  a wellbeing check, or letting HR know a staff member was in the incident.
 *  Kept apart from the database so they are tested on their own. */

/** What the request asks of HR (owner request, 22 October 2026: "it could be a
 *  simple wellbeing check but also informing HR of an incident that has staff in it"). */
export const HR_REQUEST_KINDS = {
  wellbeing: { label: "Wellbeing check", ask: "Check on someone's wellbeing", hint: "HR checks how they are after what happened." },
  inform: { label: "Staff member in an incident", ask: "Let HR know a staff member was in this incident", hint: "They were hurt or involved, and HR may need to follow up." },
} as const;
export type HrRequestKind = keyof typeof HR_REQUEST_KINDS;
export const hrRequestKind = (kind: string): HrRequestKind => (kind === "inform" ? "inform" : "wellbeing");

/** What HR may need to follow up, ticked when letting HR know about an incident. */
export const HR_FOLLOW_UPS = {
  time_off: "Time off work",
  return_to_work: "Return to work",
  support: "Support, such as the employee assistance line",
  conduct: "Their part in what happened",
} as const;
export type HrFollowUp = keyof typeof HR_FOLLOW_UPS;
const FOLLOW_UP_KEYS = Object.keys(HR_FOLLOW_UPS) as [HrFollowUp, ...HrFollowUp[]];
/** The follow-ups as people read them, in the list's order, ignoring any no longer offered. */
export const followUpLabels = (keys: string[]) => FOLLOW_UP_KEYS.filter((k) => keys.includes(k)).map((k) => HR_FOLLOW_UPS[k]);

/** How long an emailed link works. Sending it again, or HR saying what happens
 *  next, gives the link as long again. */
export const WELLBEING_LINK_DAYS = 30;
/** The most addresses Incidents > Settings sends each request to. */
export const MAX_WELLBEING_TO = 10;

export const wellbeingExpiry = (now = new Date()) => new Date(now.getTime() + WELLBEING_LINK_DAYS * 86_400_000);

/** A link's secret is 32 random bytes (shared/link.ts), 43 characters in base64url. */
export const tokenShape = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

/** A check as people read it: waiting for HR, HR following up, done, cancelled,
 *  or a link that ran out before HR finished. */
export type WellbeingState = "waiting" | "following" | "done" | "cancelled" | "expired";
export function wellbeingState(c: { status: string; expiresAt: Date; updates: number }, now = new Date()): WellbeingState {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "done") return "done";
  if (c.expiresAt <= now) return "expired";
  return c.updates ? "following" : "waiting";
}

/** Whether a link still takes updates, and what to tell HR if not. */
export function linkProblem(c: { status: string; expiresAt: Date }, now = new Date()): string | null {
  if (c.status === "cancelled") return "This request has been cancelled.";
  if (c.status === "done") return "This request is finished: nothing more was needed.";
  if (c.expiresAt <= now) return "This link has expired.";
  return null;
}

/** The addresses typed in Settings: commas, semicolons, spaces or new lines between them, each once. */
export const recipientList = (text: string) => [...new Set(text.split(/[\s,;]+/).map((a) => a.trim().toLowerCase()).filter(Boolean))];

/** What is wrong with the addresses, or null when they can be saved. None is allowed: requests then can't be sent. */
export function recipientsProblem(list: string[]): string | null {
  if (list.length > MAX_WELLBEING_TO) return `Add up to ${MAX_WELLBEING_TO} addresses.`;
  const wrong = list.find((a) => a.length > 254 || !z.string().email().safeParse(a).success);
  return wrong ? `"${wrong}" is not an email address. Use addresses like name@example.com.` : null;
}

const text = (max: number) => z.string().trim().max(max);

export const wellbeingRequestSchema = z.object({
  kind: z.enum(["wellbeing", "inform"]).default("wellbeing"),
  /** A staff member's id, or empty to type the name of someone else. */
  userId: text(64),
  name: text(200),
  reason: text(2000),
  /** Only when letting HR know: what they may need to follow up. */
  followUps: z.array(z.enum(FOLLOW_UP_KEYS)).max(FOLLOW_UP_KEYS.length).default([]),
  /** Only when letting HR know: show HR what happened, as written on the report, and the person's injury. */
  shareReport: z.boolean().default(false),
}).superRefine((r, ctx) => {
  if (r.reason.length < 10) ctx.addIssue({ code: "custom", path: ["reason"], message: r.kind === "inform" ? "Say what HR should know, in a sentence or two." : "Say why a check is needed, in a sentence or two." });
}).transform((r) => (r.kind === "inform" ? { ...r, followUps: [...new Set(r.followUps)] } : { ...r, followUps: [], shareReport: false }));
export type WellbeingRequestInput = z.input<typeof wellbeingRequestSchema>;

export const wellbeingUpdateSchema = z.object({
  token: z.string().max(64),
  byName: text(200).min(2, "Enter your name."),
  doneOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the day you did it."),
  whatDone: text(4000).min(5, "Say what you did."),
  nextSteps: text(4000),
  finished: z.boolean(),
});
export type WellbeingUpdateInput = z.input<typeof wellbeingUpdateSchema>;

/** The checks that need the day: not before the request, not in the future, and
 *  either what happens next or that nothing more is needed. */
export function updateProblem(u: { doneOn: string; nextSteps: string; finished: boolean }, askedOn: string, today: string): string | null {
  if (u.doneOn > today) return "The day can't be in the future.";
  if (u.doneOn < askedOn) return "The day can't be before HR was asked.";
  if (!u.finished && !u.nextSteps.trim()) return "Say what happens next, or tick that nothing more is needed.";
  return null;
}
