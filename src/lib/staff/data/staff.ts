import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Reads are plain async functions called straight from server components.
 *  They live apart from actions so a read cannot quietly grow a write. */
export async function getPeopleSummary() {
  await requireSession();

  const [total, admins] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, role: "ADMIN" } }),
  ]);

  return { total, admins };
}
