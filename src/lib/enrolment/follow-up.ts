import type { TagColor } from "@/components/ui-kit/tag";

export const CONTACT_OUTCOMES = {
  CONTACTED: { label: "Contacted", color: "blue" },
  NO_REPLY: { label: "No reply", color: "gray" },
  PARENT_NOT_READY: { label: "Parent not ready", color: "yellow" },
  NO_SUITABLE_CLASS: { label: "No suitable class", color: "orange" },
  AWAITING_PARENT: { label: "Awaiting parent response", color: "purple" },
  READY_TO_ENROL: { label: "Ready to enrol", color: "green" },
} as const satisfies Record<string, { label: string; color: TagColor }>;
export const CONTACT_CHANNELS = { PHONE: "Phone call", EMAIL: "Email", IN_PERSON: "In person", SMS: "Text message", INTERNAL: "Internal work / note" } as const;
export type ContactOutcome = keyof typeof CONTACT_OUTCOMES;
export type ContactChannel = keyof typeof CONTACT_CHANNELS;
export type FollowUpEntry = {
  id: string; sequence: number; actorName: string; clubName: string;
  channel: ContactChannel; outcome: ContactOutcome; note: string;
  occurredOn: string; nextContactOn: string | null; createdAt: string;
};
export type FollowUpSummary = { count: number; latest: FollowUpEntry | null };
export type FollowUpHistory = { entries: FollowUpEntry[]; nextBefore: number | null; summary: FollowUpSummary };
export type FollowUpInput = {
  studentId: string; operationId: string; expectedLatest: number | null;
  channel: string; outcome: string; note: string; occurredOn: string; nextContactOn: string;
};
