import "server-only";
// The composition root for server-side module contributions: the one place
// allowed to import every module, so Core pages can import this file instead
// of any module directly (see the import boundaries in eslint.config.mjs).
import "./activities/contributions";
import "@/modules/refunds/lib/home";
import "@/lib/docs/home";
import "@/lib/training/home";
import "@/lib/rota/home";
import "@/lib/rota/file";
import "@/lib/rota/areas";
import "@/lib/training/file";
import "@/modules/purchasing/lib/home";
import "@/modules/tasks/lib/home";
import "@/modules/academy/lib/contributions";
import "@/lib/people/home";
import "@/lib/hr/home";

export { renameAreaEverywhere, commitmentsFor, homeCardItems, planCommitment, personFile, siteSummaryLines, subjectRecords } from "./contributions";
// The swim school's top-bar tools and daily pages, for the home page's frame.
export { SwimSchoolTools } from "./activities/components/app-nav";
export { dailyPages } from "./activities/lib/nav";
