import type { TagColor } from "@/components/ui-kit/tag";
import { expandPermissions } from "@/lib/staff/permissions";

/** Roles are rows now, so there is no enum to hang a metadata map on and no
 *  compiler to catch an untinted one. What replaces it is a map keyed on how
 *  much a role can do, which is the only thing about an arbitrary role that is
 *  worth colouring — and it still comes from one place rather than a colour
 *  chosen at a call site.
 *
 *  Three bands, matching the tiers the app used to have. A club can now make
 *  ten roles, and ten tints would be ten things to learn; three says at a
 *  glance whether a role holds the keys, does the work, or only looks. */
const REACH_META: Record<"keys" | "work" | "read", { label: string; color: TagColor }> = {
  keys: { label: "Holds the keys", color: "purple" },
  work: { label: "Changes things", color: "blue" },
  read: { label: "Read only", color: "gray" },
};

export function roleReach(permissions: readonly string[]) {
  const held = expandPermissions(permissions);
  if (held.has("staff.manage") || held.has("roles.manage")) return REACH_META.keys;
  if (held.size > 0) return REACH_META.work;
  return REACH_META.read;
}

/** How a role's permission count reads in a sentence. */
export function permissionCountLabel(count: number): string {
  if (count === 0) return "No permissions";
  return `${count} ${count === 1 ? "permission" : "permissions"}`;
}

/** Long enough to be worth having, short enough to read down a phone. The
 *  same floor applies to an admin setting a temporary one and to a person
 *  choosing their own, because the temporary one is a real key until it is
 *  changed. */
export const MIN_PASSWORD_LENGTH = 12;
