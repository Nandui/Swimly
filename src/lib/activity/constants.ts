import type { TagColor } from "@/components/ui-kit/tag";

/** Audit actions are an open set, unlike a Prisma enum: every domain verb a
 *  future action invents arrives here as a string. So this map tints the three
 *  verbs every model shares and lets anything else read as gray until it has
 *  earned a tint of its own — which keeps the nine-colour vocabulary from
 *  growing a tenth entry every time someone writes a new action. */
const CORE_ACTIONS: Record<string, { label: string; color: TagColor }> = {
  create: { label: "Created", color: "green" },
  update: { label: "Updated", color: "blue" },
  delete: { label: "Deleted", color: "red" },
};

export function actionMeta(action: string): { label: string; color: TagColor } {
  const known = CORE_ACTIONS[action];
  if (known) return known;
  return { label: action.charAt(0).toUpperCase() + action.slice(1), color: "gray" };
}
