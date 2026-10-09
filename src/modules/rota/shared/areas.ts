import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** A site's area renamed in Admin: the rota's activities, repeats and bookings at that site that
 *  name it follow, so the plan keeps reading the same way (docs/admin-setup.md). */
export async function renameRotaPlaces({ siteId, from, to }: { siteId: string; from: string; to: string }, tx?: unknown) {
  const db = (tx as Prisma.TransactionClient | undefined) ?? prisma;
  const where = { siteId, place: { equals: from, mode: "insensitive" as const } };
  const [needs, repeats, bookings] = await Promise.all([
    db.rotaNeed.updateMany({ where, data: { place: to } }),
    db.rotaRepeat.updateMany({ where, data: { place: to } }),
    db.rotaBooking.updateMany({ where, data: { place: to } }),
  ]);
  return needs.count + repeats.count + bookings.count;
}
