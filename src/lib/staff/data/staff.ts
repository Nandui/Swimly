import { requirePermission, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Reads are plain async functions called straight from server components.
 *  They live apart from actions so a read cannot quietly grow a write. */
export async function getPeopleSummary() {
  await requireSession();

  const [total, admins] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({
      where: { isActive: true, staffRole: { permissions: { has: "staff.manage" } } },
    }),
  ]);

  return { total, admins };
}

/** The staff list. Needs `staff.manage`, because who holds a key is not a
 *  thing the people holding the lesser keys need to see — and the nav never
 *  offers the route to them anyway.
 *
 *  Active first, then by name, so the list reads as "who is here" with the
 *  people who have left kept below rather than hidden. */
export async function listPeople() {
  await requirePermission("staff.manage");

  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      passwordHash: true,
      staffRole: { select: { id: true, name: true, permissions: true } },
      _count: { select: { coursesTaught: true } },
    },
  });
}

/** `passwordHash` never leaves the server as itself — the list only needs to
 *  know whether one exists, so an account that cannot yet sign in can say so. */
export type Person = Omit<Awaited<ReturnType<typeof listPeople>>[number], "passwordHash"> & {
  hasPassword: boolean;
};

export async function listPeopleForDisplay(): Promise<Person[]> {
  const people = await listPeople();
  return people.map(({ passwordHash, ...rest }) => ({
    ...rest,
    hasPassword: Boolean(passwordHash),
  }));
}
