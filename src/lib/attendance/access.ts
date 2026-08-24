import type { Role } from "@/generated/prisma/client";
import { canManage, isAdmin } from "@/lib/authz";

/** Who may take a given register.
 *
 *  The scoping rule sits here rather than becoming a fourth permission tier:
 *  an instructor sees and marks their own classes and timeslots, and an admin
 *  may mark any. A class with nobody assigned needs an admin — cover staff go
 *  through a reassignment, which is deliberate and leaves a record.
 *
 *  Relaxing this to "any manage-tier user may mark any register" is one
 *  `return canManage(role)` here; `markedById` and the audit row would still
 *  say who actually did it. */
export function canMarkRegister(args: {
  role: Role;
  userId: string;
  instructorId: string | null;
}): boolean {
  if (!canManage(args.role)) return false;
  if (isAdmin(args.role)) return true;
  return args.instructorId !== null && args.instructorId === args.userId;
}
