import { Manrope } from "next/font/google";

/** The 2.0 type family, Manrope (DESIGN.md, Type; --font-text in theme/glass.css reads
 *  --font-manrope). Self-hosted by Next at build time. Set on <html> by the root layout and the
 *  global error page. */
export const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
