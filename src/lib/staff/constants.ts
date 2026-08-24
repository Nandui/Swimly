import type { TagColor } from "@/components/ui-kit/tag";
import type { Role } from "@/generated/prisma/client";

/** One map per enum. Call sites read the label and the tint from here and
 *  never write either inline — so adding a role to the schema is a type error
 *  until it has both, which is how the untinted status gets caught by the
 *  compiler instead of by a reviewer. */
export const ROLE_META: Record<Role, { label: string; color: TagColor }> = {
  ADMIN: { label: "Admin", color: "purple" },
  INSTRUCTOR: { label: "Instructor", color: "blue" },
  VIEWER: { label: "Viewer", color: "gray" },
};
