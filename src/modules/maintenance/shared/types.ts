import { ChevronsDown, CircleCheck, CircleSlash, ClipboardList, Inbox, Minus, Siren } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Maintenance's words, pure: server and client both read them. Each status and urgency has its
 *  own icon, so colour is never the only signal. */

export const MAINTENANCE_STATUSES = ["reported", "in_trackplan", "fixed", "closed"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
/** Reported waits for a manager to put it in Trackplan (orange, needs action); In Trackplan waits
 *  on the maintenance team (blue); Fixed is done (green); Closed, not fixed is grey. */
export const MAINTENANCE_STATUS_META = {
  reported: { label: "Reported", color: "orange", icon: Inbox },
  in_trackplan: { label: "In Trackplan", color: "blue", icon: ClipboardList },
  fixed: { label: "Fixed", color: "green", icon: CircleCheck },
  closed: { label: "Closed, not fixed", color: "gray", icon: CircleSlash },
} as const satisfies Record<MaintenanceStatus, StatusMeta>;
export const OPEN_STATUSES = ["reported", "in_trackplan"] as const satisfies readonly MaintenanceStatus[];

export const URGENCIES = ["low", "normal", "urgent"] as const;
export type Urgency = (typeof URGENCIES)[number];
/** Only Urgent is coloured (red, serious); Low and Normal stay quiet. */
export const MAINTENANCE_URGENCY_META = {
  low: { label: "Low", color: "gray", icon: ChevronsDown },
  normal: { label: "Normal", color: "gray", icon: Minus },
  urgent: { label: "Urgent", color: "red", icon: Siren },
} as const satisfies Record<Urgency, StatusMeta>;

export const RISKS = ["none", "out_of_use", "could_hurt"] as const;
export type Risk = (typeof RISKS)[number];
export const RISK_LABEL: Record<Risk, string> = { none: "No", out_of_use: "It is out of use", could_hurt: "It could hurt someone" };
/** How a risk reads among a request's facts. */
export const RISK_FACT: Record<Risk, string> = { none: "Still in use, no risk", out_of_use: "Out of use", could_hurt: "Could hurt someone" };

export const TRACKPLAN_ANSWERS = ["yes", "no", "unsure"] as const;
export type TrackplanAnswer = (typeof TRACKPLAN_ANSWERS)[number];
export const TRACKPLAN_LABEL: Record<TrackplanAnswer, string> = { yes: "Yes", no: "No", unsure: "Not sure" };

/** The history's words for each step. */
export const MAINTENANCE_ACTIONS = {
  report: "Reported",
  trackplan: "Put in Trackplan",
  fix: "Marked fixed",
  close: "Closed, not fixed",
  reopen: "Opened again",
  correct: "Details corrected",
  photo_add: "Photo added",
  photo_remove: "Photo removed",
} as const;
export type MaintenanceAction = keyof typeof MAINTENANCE_ACTIONS;

/** The moves Manage makes on a request's page. */
export const MOVES = ["trackplan", "fix", "close", "reopen"] as const;
export type Move = (typeof MOVES)[number];

export const maintenanceNumber = (n: number) => `M-${String(n).padStart(4, "0")}`;

/** How many photos a request takes, and how big each may arrive. They are shrunk before keeping. */
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** One request as screens see it: no bytes, no Core rows. */
export type MaintenanceView = {
  id: string; number: number; status: MaintenanceStatus; version: number;
  siteId: string; siteName: string; area: string; place: string; title: string; details: string;
  urgency: Urgency; risk: Risk; trackplan: TrackplanAnswer; trackplanRef: string; outcome: string;
  duplicateOf: { id: string; number: number; title: string } | null;
  reportedById: string; reportedByName: string; closedByName: string | null; closedAt: string | null;
  createdAt: string; updatedAt: string;
};
export type MaintenancePhotoView = { id: string; name: string; addedByName: string; createdAt: string };
export type MaintenanceHistory = { id: string; action: MaintenanceAction; actorName: string; note: string; createdAt: string };
export type MaintenanceResult = { ok: true; id: string } | { ok: false; error: string };
