#!/usr/bin/env node
// UI rules that ESLint cannot see file by file (CLAUDE.md, "UI rules", owner rule 20 October 2026):
//   1. Every page uses PageShell (and so PageHeader, which turnfin/page-header-in-shell keeps
//      inside it): each src/app page.tsx must reach a <PageShell> through its own imports.
//      A page that only redirects or 404s renders nothing and is skipped.
//   2. No new colours in stylesheets: colour literals (hex, rgb(), hsl(), oklch(), color-mix())
//      live only in the theme files, src/app/theme/poolside.css and src/app/shadcn.css; every
//      other stylesheet uses their tokens.
// Run by `npm run lint`. Exits 1 and lists every problem when a rule is broken.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const src = join(root, "src");
const problems = [];

function walk(dir, keep, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== "generated" && name !== "node_modules") walk(path, keep, out); }
    else if (keep(path)) out.push(path);
  }
  return out;
}

// ── 1. Every page reaches PageShell.
const IMPORT = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const sources = new Map();
const read = (file) => { if (!sources.has(file)) sources.set(file, readFileSync(file, "utf8")); return sources.get(file); };
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}
const SHELL = join(src, "components/ui-kit/page-shell.tsx");
const usesShell = (file) => file !== SHELL && /<PageShell[\s>]/.test(read(file));
function reachesShell(page) {
  const seen = new Set([page]);
  const queue = [page];
  while (queue.length) {
    const file = queue.shift();
    if (file.endsWith(".tsx") && usesShell(file)) return true;
    const barrel = file.endsWith(".ts");
    for (const match of read(file).matchAll(IMPORT)) {
      // Pages reach their screen through components, or through a feature's index.ts barrel
      // (its `export … from` lines); server code and data never hold one.
      if (barrel && !match[0].startsWith("export")) continue;
      const next = resolveImport(file, match[1] ?? match[2]);
      if (next && (next.endsWith(".tsx") || next.endsWith(".ts")) && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return false;
}
const rendersNothing = (page) => !/return\s*\(?\s*</.test(read(page)) && !/=>\s*\(?\s*</.test(read(page));

for (const page of walk(join(src, "app"), (path) => /[\\/]page\.tsx$/.test(path))) {
  if (rendersNothing(page)) continue;
  if (!reachesShell(page)) problems.push(`${relative(root, page)}: the page never renders <PageShell header={<PageHeader … />}> (CLAUDE.md, UI rules)`);
}

// ── 2. Colour literals only in the theme files.
const THEME = new Set(["src/app/theme/poolside.css", "src/app/shadcn.css"]);
const COLOUR = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/gi;
for (const sheet of walk(src, (path) => path.endsWith(".css"))) {
  const name = relative(root, sheet).split("\\").join("/");
  if (THEME.has(name)) continue;
  read(sheet).replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")).split("\n").forEach((line, i) => {
    for (const match of line.matchAll(COLOUR)) {
      // Hex inside a selector or URL fragment (`#po-waiting`, `url(#id)`) is not a colour.
      if (match[0].startsWith("#") && !/:[^;{]*$/.test(line.slice(0, match.index))) continue;
      problems.push(`${name}:${i + 1}: colour literal ${match[0]}: use a theme token from poolside.css or shadcn.css (CLAUDE.md, UI rules)`);
    }
  });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n✖ ${problems.length} UI rule problem${problems.length === 1 ? "" : "s"} (scripts/lint/ui-rules.mjs)`);
  process.exit(1);
}
console.log("UI rules: every page uses PageShell; stylesheets use theme colours only.");
