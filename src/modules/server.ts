import "server-only";
// The composition root for server-side module contributions: the one place
// allowed to import every module, so Core pages can import this file instead
// of any module directly (see the import boundaries in eslint.config.mjs).
import "./activities/contributions";

export { siteSummaryLines, staffColumnValues } from "./contributions";
