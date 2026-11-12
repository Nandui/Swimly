import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  /** Shown on What's new and in the account menu (src/lib/app.ts). */
  env: { APP_VERSION: version },
  outputFileTracingIncludes: {
    "/whats-new": ["./CHANGELOG.md"],
    "/help/images/*": ["./assets/help/*.png"],
    "/api/parent/v1/**": ["./assets/email/*.png"],
    // Purchase order emails carry the logo; the server action runs from the order pages.
    "/purchasing/**": ["./assets/email/*.png"],
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
  /** Old links and bookmarks land on the same page in the app that holds it now (D24). */
  async redirects() {
    return [
      // Checking certificates, what is expiring and in-service hours left Training for Qualifications (D26).
      { source: "/training/expiring", destination: "/staff-qualifications", permanent: false },
      { source: "/training/certificates", destination: "/staff-qualifications/certificates", permanent: false },
      { source: "/training/certificates/:path*", destination: "/staff-qualifications/certificates/:path*", permanent: false },
      { source: "/training/hours", destination: "/staff-qualifications/hours", permanent: false },
      // Short courses joined the swim school; their own overview went with their frame.
      { source: "/short-courses/overview", destination: "/short-courses", permanent: false },
      // The Academy left Short courses for its own app, at /academy again.
      { source: "/short-courses/academy", destination: "/academy", permanent: false },
      { source: "/short-courses/academy/:path*", destination: "/academy/:path*", permanent: false },
      // Refunds and Coinage became Finance requests (D24): their overviews are its one Overview.
      { source: "/refunds/overview", destination: "/finance-requests", permanent: false },
      { source: "/coinage/overview", destination: "/finance-requests", permanent: false },
    ];
  },
};

export default nextConfig;
