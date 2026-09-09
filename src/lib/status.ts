import type { TagColor } from "@/components/ui-kit/tag";


export type StatusMeta = { label: string; color: TagColor };

/** Archiving means the same thing across the timetable and curriculum. */
export const ARCHIVAL_STATUS_META = {
  archived: { label: "Archived", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
