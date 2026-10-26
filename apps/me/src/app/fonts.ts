import { Inter } from "next/font/google";

/** The 2.0 type family is the Apple system font; Inter, with its optical sizes, stands in on
 *  Windows and Android (--font-text in theme/glass.css, which reads --font-inter). Self-hosted
 *  by Next at build time. Set on <html> by the root layout and the global error page. */
export const inter = Inter({ subsets: ["latin"], axes: ["opsz"], display: "swap", variable: "--font-inter" });
