import type { TagColor } from "@/components/ui-kit/tag";

/** Audit actions are an open set, unlike a Prisma enum: every domain verb a
 *  future action invents arrives here as a string, so this map cannot be
 *  exhaustive the way an enum can, and the compiler cannot catch a missing
 *  entry. What it can do is cover every verb the app actually writes today and
 *  let anything else read as gray until it has earned a tint of its own —
 *  which keeps the nine-colour vocabulary from growing a tenth entry every
 *  time somebody adds an action.
 *
 *  Keep this in step with the `action:` values written by the actions under
 *  `src/lib/<domain>/actions/`. */
const ACTIONS: Record<string, { label: string; color: TagColor }> = {
  // Shared across every model
  create: { label: "Created", color: "green" },
  update: { label: "Updated", color: "blue" },
  delete: { label: "Deleted", color: "red" },
  archive: { label: "Archived", color: "gray" },
  restore: { label: "Restored", color: "green" },
  reorder: { label: "Reordered", color: "gray" },

  // Enrolment
  enrol: { label: "Enrolled", color: "green" },
  waitlist: { label: "Waitlisted", color: "yellow" },
  withdraw: { label: "Withdrew", color: "gray" },
  complete: { label: "Finished", color: "blue" },
  transfer: { label: "Moved", color: "purple" },

  // The pool deck
  attendance: { label: "Register", color: "blue" },
  assess: { label: "Assessed", color: "yellow" },
  "complete-level": { label: "Level passed", color: "green" },
  "revoke-level": { label: "Level revoked", color: "orange" },

  // Assessment sessions
  book: { label: "Booked", color: "green" },
  "cancel-booking": { label: "Booking cancelled", color: "gray" },
  "no-show": { label: "Did not come", color: "orange" },
  placed: { label: "Placed", color: "purple" },
};

export function actionMeta(action: string): { label: string; color: TagColor } {
  const known = ACTIONS[action];
  if (known) return known;
  // Last resort, and it should look like one: sentence-case the raw verb.
  return {
    label: action.charAt(0).toUpperCase() + action.slice(1).replace(/-/g, " "),
    color: "gray",
  };
}
