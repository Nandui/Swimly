import type { NextConfig } from "next";

/** Turnfin Courses is its own app inside the Swimly repository: its own project root, so
 *  builds are separate and Turnfin's dev server never triggers reloads here. It reads the
 *  repository's Prisma schema (../../prisma/schema) at generate time only. */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
