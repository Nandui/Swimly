import "server-only";
// The composition root for server-side module contributions: the one place
// allowed to import every module, so Core pages can import this file instead
// of any module directly (see the import boundaries in eslint.config.mjs).
import "@/modules/activities/module";
import "@/modules/refunds/module";
import "@/modules/docs/module";
import "@/modules/training/module";
import "@/modules/rota/module";
import "@/modules/purchasing/module";
import "@/modules/tasks/module";
import "@/modules/academy/module";
import "@/lib/people/home";
import "@/modules/hr/module";

export { renameAreaEverywhere, homeCardItems, siteSummaryLines } from "./contributions";
// The swim school's top-bar tools and daily pages, for the home page's frame.
export { dailyPages, SwimSchoolTools } from "@/modules/activities";
