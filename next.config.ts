import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  /** Shown on What's new and in the account menu (src/lib/app.ts). */
  env: { APP_VERSION: version },
  outputFileTracingIncludes: {
    "/whats-new": ["./CHANGELOG.md"],
    "/help/images/*": ["./assets/help/*.png"],
    "/api/parent/v1/**": ["./assets/email/*.png"],
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
  /** The Academy joined Short courses (owner decision, 15 October 2026): old links and
   *  bookmarks land on the same page there. */
  async redirects() {
    return [
      { source: "/academy/overview", destination: "/short-courses/overview", permanent: false },
      { source: "/academy", destination: "/short-courses/academy", permanent: false },
      { source: "/academy/:path*", destination: "/short-courses/academy/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
