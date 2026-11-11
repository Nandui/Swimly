"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/authz";
import { SITE_MEMORY_APPS, siteCookie, type SiteMemoryApp } from "@/lib/site-memory";

/** Remembers the site picked in an app's site picker, so its pages open there without `?site=`.
 *  Not audited: like the working site, it changes what one person sees on one device, and no
 *  data. Setting the cookie here also clears the browser's kept pages, which were drawn for the
 *  site before. */
export async function rememberSite(app: SiteMemoryApp, siteId: string): Promise<void> {
  await requireSession();
  if (!SITE_MEMORY_APPS.includes(app) || !/^[\w-]{1,100}$/.test(siteId)) return;
  (await cookies()).set(siteCookie(app), siteId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath(`/${app}`, "layout");
}
