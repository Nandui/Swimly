import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { moveLoneBlocks } from "@/modules/plan/shared/move-lone-blocks";

/** Plan (test): moves work that was planned on a kind of work by itself onto activities
 *  (docs/decisions.md, D33). For each such block from today on, it either joins an activity already
 *  at the site that needs that kind of work and covers its times, or a new activity is made for it
 *  and its like. Days gone by, and breaks, are left alone.
 *
 *  Dry run by default: it prints what it would do and changes nothing. Read that first. Pass
 *  --confirm to write; every move is audited. Running it again finds nothing left to move.
 *    npx tsx scripts/plan-move-lone-blocks.ts
 *    npx tsx scripts/plan-move-lone-blocks.ts --confirm
 *    npx tsx scripts/plan-move-lone-blocks.ts --from=2026-12-01 */
async function main() {
  const confirm = process.argv.includes("--confirm");
  const from = process.argv.find((a) => a.startsWith("--from="))?.slice("--from=".length);
  if (from !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("--from takes a day as YYYY-MM-DD.");
  const result = await moveLoneBlocks({ confirm, from });
  if (result.moves.length === 0) return console.log(`Nothing to move: from ${result.from} on, everything planned is on an activity or is a break.`);
  let site = "";
  for (const m of result.moves) {
    if (m.site !== site) { site = m.site; console.log(`\n${site}`); }
    console.log(`  ${m.what} (${m.people} block${m.people === 1 ? "" : "s"} over ${m.days} day${m.days === 1 ? "" : "s"})`);
  }
  const blocks = result.moves.reduce((sum, m) => sum + m.people, 0);
  const made = result.moves.filter((m) => m.move.kind === "make").length;
  console.log(`\n${blocks} block${blocks === 1 ? "" : "s"} from ${result.from} on ${result.written ? "moved" : "would move"}: ${result.moves.length - made} onto activities already there, ${made} new activit${made === 1 ? "y" : "ies"}.`);
  if (!result.written) console.log("Dry run. Nothing was changed. Pass --confirm to write.");
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
