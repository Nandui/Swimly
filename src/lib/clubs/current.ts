import { cache } from "react";
import { cookies } from "next/headers";
import { CLUB_COOKIE } from "@/lib/clubs/constants";
import { prisma } from "@/lib/prisma";

export type CurrentClub = { id: string; name: string };

/** Which club this request is working in, and the live clubs it could be.
 *
 *  Read from the cookie and checked against the clubs that exist, so a stale
 *  or tampered value falls back to the first club rather than to nothing. One
 *  small query per request, memoised: every data module asks, and every page
 *  asks through several of them. */
export const getCurrentClub = cache(
  async (): Promise<{ club: CurrentClub; clubs: CurrentClub[] }> => {
    const clubs = await prisma.club.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    if (clubs.length === 0) throw new Error("No club is set up. Run the migrations.");

    const wanted = (await cookies()).get(CLUB_COOKIE)?.value;
    return { club: clubs.find((club) => club.id === wanted) ?? clubs[0], clubs };
  }
);

/** The one thing most reads need. */
export async function currentClubId(): Promise<string> {
  return (await getCurrentClub()).club.id;
}

/** For code that also runs outside a request — the audit log written by a
 *  script has no cookie to read, and should say so with null rather than
 *  crash the script. */
export async function currentClubIdIfAny(): Promise<string | null> {
  try {
    return await currentClubId();
  } catch {
    return null;
  }
}
