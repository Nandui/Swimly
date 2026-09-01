"use server";

import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** A read, in the actions folder, on purpose.
 *
 *  The reads live in `data/` and are called from server components. This one
 *  is called from a **client** component — the swimmer picker — while somebody
 *  is typing, and a server action is the only way a client component reaches
 *  the database without an API route. So it is marked `"use server"` and it
 *  lives here, where every other thing the browser can call lives.
 *
 *  It exists because the alternative was shipping every swimmer to the browser
 *  so a person could find one. That was 1,156 rows on the course page and again
 *  on Together — the same weight `/students` was carrying before it was paged.
 *  Twenty rows for the letters typed so far is the whole answer. */

export type StudentHit = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  memberNumber: string | null;
};

const LIMIT = 20;

export async function searchStudents(q: string, exclude: string[] = []): Promise<StudentHit[]> {
  await requireSession();

  // Each word has to land somewhere, so "ava by" finds Ava Byrne and neither
  // Ava Lynch nor Tom Byrne. A member number is one word and matches itself.
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4);
  if (terms.length === 0) return [];

  const where: Prisma.StudentWhereInput = {
    status: "ACTIVE",
    ...(exclude.length ? { id: { notIn: exclude.slice(0, 50) } } : {}),
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { memberNumber: { contains: term, mode: "insensitive" } },
      ],
    })),
  };

  const rows = await prisma.student.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    // Over-fetch so there is something to rank. The database can say who
    // matches; it cannot say who matches *best*.
    take: LIMIT * 3,
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, memberNumber: true },
  });

  // Names the typing *starts* come first. Sorted by surname alone, "ava" put
  // Alavala and Bhavanibhatla above every Ava in the club, because a substring
  // is a substring. Every term has to lead a word for a row to rank ahead;
  // within a rank the alphabetical order from the database stands.
  const leads = (row: StudentHit) => {
    const words = [row.firstName, row.lastName, row.memberNumber ?? ""].map((w) => w.toLowerCase());
    return terms.every((term) => words.some((w) => w.startsWith(term)));
  };
  return rows
    .map((row, index) => ({ row, index, lead: leads(row) ? 0 : 1 }))
    .sort((a, b) => a.lead - b.lead || a.index - b.index)
    .slice(0, LIMIT)
    .map((entry) => entry.row);
}
