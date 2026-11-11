import "server-only";
import { cookies } from "next/headers";
import { siteCookie, type SiteMemoryApp } from "@/lib/site-memory";

/** The site the person last picked in an app's site picker, for a page opened without `?site=`.
 *  Unchecked: the caller looks it up among the sites the person covers and falls back to its own
 *  default when it is not there. Outside a request (a script, a test) there is none. */
export async function rememberedSite(app: SiteMemoryApp): Promise<string | undefined> {
  try {
    return (await cookies()).get(siteCookie(app))?.value || undefined;
  } catch {
    return undefined;
  }
}
