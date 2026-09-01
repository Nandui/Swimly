import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
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
};

export default nextConfig;
