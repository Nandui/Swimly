import { cache } from "react";
import { cookies } from "next/headers";
import { CLUB_COOKIE } from "@/lib/clubs/constants";
import { prisma } from "@/lib/prisma";
import { operationContext } from "@/lib/operations/context";

export type CurrentClub = { id: string; name: string };

/** Which site this request is working in, and the live sites the person may
 *  work at (the site picker's list).
 *
 *  Read from the cookie and checked against the sites that exist and the
 *  person's own sites (`User.siteIds`; none means every site). A missing,
 *  stale or tampered value falls back to their primary site, then to the
 *  first site they may work at, rather than to a site they do not work at.
 *  One small query per request, memoised: every data module asks, and every
 *  page asks through several of them. A script's operation context names its
 *  site outright and skips the person. */
export const getCurrentClub = cache(
  async (): Promise<{ club: CurrentClub; clubs: CurrentClub[] }> => {
    const live = await prisma.club.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    if (live.length === 0) throw new Error("No club is set up. Run the migrations.");

    const operation = operationContext.getStore()?.clubId;
    if (operation) return { club: live.find((club) => club.id === operation) ?? live[0], clubs: live };

    // Imported when needed: auth builds its session from this module. `signedInSites` reads
    // the sign-in cookie alone (never `auth()`), so the two never wait on each other.
    const own = await import("@/auth").then((mod) => mod.signedInSites()).catch(() => null);
    const wanted = (await cookies()).get(CLUB_COOKIE)?.value;
    return pickClub(live, wanted, own);
  }
);

/** The working site, pure: the site picked in the cookie when the person may work there, else
 *  their Main site (`User.primaryClubId`) when it is one of theirs, else the first of their
 *  Works at sites, else the first live site. No Works at sites means every site. */
export function pickClub<T extends { id: string }>(live: T[], wanted: string | undefined, own: { primary: string | null; sites: string[] } | null): { club: T; clubs: T[] } {
  const theirs = own?.sites.length ? live.filter((club) => own.sites.includes(club.id)) : [];
  const clubs = theirs.length > 0 ? theirs : live;
  const firstOfTheirs = own?.sites.map((id) => theirs.find((c) => c.id === id)).find(Boolean);
  const club = clubs.find((c) => c.id === wanted) ?? clubs.find((c) => c.id === own?.primary) ?? firstOfTheirs ?? clubs[0];
  return { club, clubs };
}

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
