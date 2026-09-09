import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Keep tracing, environment loading and Tailwind discovery inside this app.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  devIndicators: false,
};
export default config;
