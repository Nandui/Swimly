import { Eye, History, KeyRound, Lock, Pencil, TriangleAlert, UserCog } from "lucide-react";
import { expandPermissions, hasAdministratorAccess } from "@/lib/staff/permissions";
import type { StatusMeta } from "@/lib/status";

export const STAFF_STATUS_META = {
  noPassword: { label: "No password set", color: "orange", icon: TriangleAlert },
  builtInRole: { label: "Built in", color: "gray", icon: Lock },
  oldSettings: { label: "Old settings until saved", color: "orange", icon: History },
} as const satisfies Record<string, StatusMeta>;

/** Roles are rows now, so there is no enum to hang a metadata map on and no
 *  compiler to catch an untinted one. What replaces it is a map keyed on how
 *  much a role can do, which is the only thing about an arbitrary role that is
 *  worth colouring — and it still comes from one place rather than a colour
 *  chosen at a call site.
 *
 *  Full administrator access is distinguished from a role holding only one
 *  management key, so a restricted manager is never labelled an admin. */
export const REACH_META = {
  administrator: { label: "Administrator", color: "purple", icon: KeyRound },
  keys: { label: "Holds the keys", color: "purple", icon: UserCog },
  work: { label: "Changes things", color: "blue", icon: Pencil },
  read: { label: "Read only", color: "gray", icon: Eye },
} as const satisfies Record<"administrator" | "keys" | "work" | "read", StatusMeta>;

export function roleReach(permissions: readonly string[]) {
  if (hasAdministratorAccess(permissions)) return REACH_META.administrator;
  const held = expandPermissions(permissions);
  if (held.has("staff.manage") || held.has("roles.manage")) return REACH_META.keys;
  // The audit log is a read permission; by itself it cannot change records.
  if ([...held].some((permission) => permission !== "activity.view")) return REACH_META.work;
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
export const MIN_PASSWORD_LENGTH = 8;
