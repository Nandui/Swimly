import path from "node:path";
import type { NextConfig } from "next";

/** Turnfin Activities: the swim school (office, desk and pool deck) and its
 *  parent API, as its own Next.js app. Staff reach it through Turnfin Work,
 *  which forwards the Activities paths here (Next.js multi-zones), so both
 *  apps share one address, one sign-in and one database. The code lives in the
 *  repository's `src/` (Core and `src/modules/activities`); this folder holds
 *  only the routes. See docs/architecture.md.
 *
 *  Run from the repository root: `npm run dev:activities`. */

/** Must equal ACTIVITIES_ASSET_PREFIX in src/lib/zones.ts (a test checks it):
 *  Next.js cannot load TypeScript from outside this folder in its config. */
const ACTIVITIES_ASSET_PREFIX = "/activities-static";

// Commands run from the repository root; Vercel may start in this folder.
const repoRoot = process.cwd().endsWith(path.join("apps", "activities")) ? path.resolve(process.cwd(), "../..") : process.cwd();

/** Hosts whose pages may call this app's server actions: the Work address
 *  staff use, e.g. "turnfin.example.ie". Locally, Work on port 3000 (`npm run
 *  dev`) or 3100 (the sandbox). */
const workOrigins = (process.env.WORK_ORIGIN ?? (process.env.NODE_ENV === "production" ? "" : "localhost:3000,localhost:3100"))
  .split(",").map((origin) => origin.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")).filter(Boolean);

/** Work's own address, for the shared brand images in the repository's
 *  public/ folder, which only Work serves. Browsers normally load them through
 *  Work already; this covers opening the Activities app directly. */
const workUrl = (process.env.WORK_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")).replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Its JavaScript and CSS live under their own prefix so they never collide
  // with Work's /_next; Work forwards this prefix here too.
  assetPrefix: ACTIVITIES_ASSET_PREFIX,
  env: { NEXT_PUBLIC_TURNFIN_ZONE: "activities" },
  // As in Work: navigations into the other app become full page loads.
  deploymentId: process.env.NODE_ENV === "development" ? "turnfin-activities-dev" : undefined,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/parent/v1/**": ["../../assets/email/*.png"],
  },
  async rewrites() {
    return workUrl ? { beforeFiles: [], afterFiles: [], fallback: [{ source: "/brand/:file*", destination: `${workUrl}/brand/:file*` }] } : [];
  },
  experimental: {
    serverActions: {
      // A 2 MB curriculum image plus multipart form overhead.
      bodySizeLimit: "3mb",
      // Pages are served on Work's address, so its origin must be allowed.
      allowedOrigins: workOrigins,
    },
    // As in Work: reuse a dynamic page for 30 seconds; every action
    // revalidates what it changed.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
