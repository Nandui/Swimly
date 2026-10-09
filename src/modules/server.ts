import "server-only";
// The composition root for server-side module contributions: the one place
// allowed to import every module, so Core pages can import this file instead
// of any module directly (see the import boundaries in eslint.config.mjs).
import "./activities/contributions";
import "@/modules/refunds/module";
import "@/modules/docs/lib/home";
import "@/modules/training/lib/home";
import "@/modules/rota/lib/home";
import "@/modules/rota/lib/file";
import "@/modules/rota/lib/areas";
import "@/modules/training/lib/file";
import "@/modules/purchasing/lib/home";
import "@/modules/tasks/lib/home";
import "@/modules/academy/lib/contributions";
import "@/lib/people/home";
import "@/modules/hr/lib/home";

export { renameAreaEverywhere, commitmentsFor, homeCardItems, planCommitment, personFile, siteSummaryLines, subjectRecords } from "./contributions";
// The swim school's top-bar tools and daily pages, for the home page's frame.
export { SwimSchoolTools } from "./activities/components/app-nav";
export { dailyPages } from "./activities/lib/nav";
