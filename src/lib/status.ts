import { Archive, type LucideIcon } from "lucide-react";

/** The six status tones of Poolside Clear v2. Orange is the warning (amber) tone. */
export type TagColor = "green" | "blue" | "orange" | "red" | "purple" | "gray";

/** A status always travels with its words, its semantic tone and its icon, so
 *  colour is never the only signal. Render one with `<Tag meta={…} />`.
 *  Icons are components: pass a status key, never a meta object, from a server
 *  component to a client one. */
export type StatusMeta = { label: string; color: TagColor; icon: LucideIcon };

/** Archiving means the same thing across the timetable and curriculum. */
export const ARCHIVAL_STATUS_META = {
  archived: { label: "Archived", color: "gray", icon: Archive },
} as const satisfies Record<string, StatusMeta>;

