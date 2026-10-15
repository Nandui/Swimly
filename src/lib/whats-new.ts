import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

/** One piece of a release's notes: a list of changes, a small heading that groups the
 *  lists under it ("**Tasks**"), or a plain sentence. Text may hold **bold** words. */
export type ReleaseBlock =
  | { kind: "list"; items: string[] }
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string };

export type Release = { version: string; date: string; title: string; blocks: ReleaseBlock[] };

export type ReleaseNotes = { intro: string[]; releases: Release[] };

const RELEASE_HEADING = /^##\s+(\d+\.\d+\.\d+)\s+·\s+(.+?)\s+·\s+(.+)$/;
const SUBHEADING = /^\*\*([^*]+)\*\*$/;

/** Reads CHANGELOG.md's own shape: a title, a few lines about the list, then one
 *  "## <version> · <date> · <title>" section per release, newest first. CHANGELOG.md is
 *  the one source: it is written for staff, so What's new shows it as it is. */
export function parseReleaseNotes(markdown: string): ReleaseNotes {
  const intro: string[] = [];
  const releases: Release[] = [];
  let current: Release | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      current = { version: heading[1], date: heading[2], title: heading[3], blocks: [] };
      releases.push(current);
      continue;
    }
    if (!line || line.startsWith("# ")) continue;
    if (!current) {
      intro.push(line);
      continue;
    }
    const blocks = current.blocks;
    const last = blocks.at(-1);
    if (line.startsWith("- ")) {
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
    } else if (raw.startsWith("  ") && last?.kind === "list") {
      // A wrapped bullet carries on the line before.
      last.items[last.items.length - 1] += ` ${line}`;
    } else {
      const sub = SUBHEADING.exec(line);
      blocks.push(sub ? { kind: "heading", text: sub[1] } : { kind: "text", text: line });
    }
  }
  return { intro, releases };
}

/** Splits "a **b** c" into plain and bold runs, for the page to render without raw HTML. */
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter((run) => run.text);
}

/** CHANGELOG.md at the project root; next.config.ts ships it with the What's new page. */
export const releaseNotes = cache(async (): Promise<ReleaseNotes> =>
  parseReleaseNotes(await readFile(join(process.cwd(), "CHANGELOG.md"), "utf8")));
