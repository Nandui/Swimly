import { prisma } from "@/lib/prisma";

/** The staff account a command-line operator acts as, named by
 *  SWIMLY_OPERATIONS_ACTOR. It must be exactly one active account with a role;
 *  anything else is refused by the caller. */
export async function operatorAccounts(name: string) {
  return prisma.user.findMany({
    where: { name, isActive: true },
    take: 2,
    select: { id: true, name: true, staffRole: { select: { id: true, name: true, permissions: true } } },
  });
}
