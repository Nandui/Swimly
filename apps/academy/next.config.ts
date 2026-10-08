import type { NextConfig } from "next";

/** The Academy booking site has no server data of its own: every page is a client of the Turnfin
 *  Academy API (NEXT_PUBLIC_ACADEMY_API_URL). */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Its own project root, not the Swimly repository around it: separate builds, and Work's dev
  // server never triggers reloads here.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
