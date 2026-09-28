import type { NextConfig } from "next";
import { ACTIVITIES_ASSET_PREFIX, ACTIVITIES_PATHS } from "./src/lib/zones";

/** Turnfin Activities is its own app (apps/activities). Work forwards the
 *  Activities paths and its asset prefix there (Next.js multi-zones), so staff
 *  keep one address and one sign-in. Locally it runs on port 3102; deployed,
 *  ACTIVITIES_URL is required (scripts/check-env.ts). */
const activitiesUrl = (process.env.ACTIVITIES_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3102")).replace(/\/$/, "");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_TURNFIN_ZONE: "work" },
  // A navigation that lands on the other app's page must load it fully. Next
  // does that when the page comes from a different build; deployed builds
  // always differ, but in development both apps share one build id, so name
  // each app's development deployment.
  deploymentId: process.env.NODE_ENV === "development" ? "turnfin-work-dev" : undefined,
  outputFileTracingIncludes: {
    "/help/images/*": ["./assets/help/*.png"],
  },
  experimental: {
    // A 2 MB curriculum image plus multipart form overhead.
    serverActions: { bodySizeLimit: "3mb" },
    /** Every page here is dynamic — reading the session makes it so — and a
     *  dynamic route's client-side payload is cached for 0 seconds by default.
     *  That means going Courses → a class → back re-runs the whole page on the
     *  server, over a database in another country, to redraw something that
     *  was on screen a moment ago. Thirty seconds of reuse makes moving around
     *  the app feel instant without letting anything go meaningfully stale:
     *  every mutating action already calls `revalidatePath`, which clears this
     *  cache, so a change you just made is never the thing being reused. */
    staleTimes: { dynamic: 30, static: 180 },
  },
  async rewrites() {
    if (!activitiesUrl) return [];
    return [
      ...ACTIVITIES_PATHS.flatMap((path) => [
        { source: path, destination: `${activitiesUrl}${path}` },
        { source: `${path}/:rest*`, destination: `${activitiesUrl}${path}/:rest*` },
      ]),
      { source: `${ACTIVITIES_ASSET_PREFIX}/:rest+`, destination: `${activitiesUrl}${ACTIVITIES_ASSET_PREFIX}/:rest+` },
    ];
  },
};

export default nextConfig;
