import "server-only";
// The composition root for server-side module contributions: the one place
// allowed to import every module, so Core pages can import this file instead
// of any module directly (see the import boundaries in eslint.config.mjs).
import "./activities/contributions";
import "@/lib/refunds/home";
import "@/lib/docs/home";
import "@/lib/training/home";
import "@/lib/rota/home";
import "@/lib/rota/file";
import "@/lib/hr/home";
import "@/lib/people/home";

export { homeCardItems, personFile, siteSummaryLines, staffColumnValues } from "./contributions";
