import type { HelpSummary } from "./catalogue";
import { HELP_CATEGORIES, type HelpCategory, type HelpScope } from "./types";

export type HelpFilters = { q: string; topic: HelpCategory | "all" };
export function helpFilters(q?: string | null, topic?: string | null): HelpFilters {
  return { q: (q ?? "").slice(0, 160), topic: HELP_CATEGORIES.some(item => item.id === topic) ? topic as HelpCategory : "all" };
}

export function helpHref(scope: HelpScope, slug?: string, filters?: HelpFilters): string {
  const base = scope === "instructor" ? "/help/instructor" : "/help";
  const params = new URLSearchParams();
  const clean = helpFilters(filters?.q, filters?.topic);
  if (clean.q.trim()) params.set("q", clean.q.trim());
  if (clean.topic !== "all") params.set("topic", clean.topic);
  return `${base}${slug ? `/${encodeURIComponent(slug)}` : ""}${params.size ? `?${params}` : ""}`;
}

const FILLER = new Set(["a", "an", "the", "to", "of", "in", "on", "for", "and", "how", "do", "does", "i", "can", "my", "with", "is", "it"]);
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\benroll(?:ment|ing|ed|s)?\b/g, "enrol")
    .replace(/\benrol(?:ment|ling|led|s)?\b/g, "enrol")
    .replace(/\bsibbling(s)?\b/g, "sibling$1")
    .replace(/\b(?:transfer|transfers|transferring)\b/g, "move")
    .replace(/\bregister\b/g, "attendance")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

/** Every meaningful word must match. Title and task vocabulary outrank incidental mentions. */
export function searchHelp(articles: HelpSummary[], filters: HelpFilters): HelpSummary[] {
  const words = [...new Set(normalize(filters.q).split(" ").filter(word => word && !FILLER.has(word)))];
  return articles.filter(article => filters.topic === "all" || article.category === filters.topic)
    .map(article => {
      const title = normalize(article.title), keywords = normalize(article.keywords), summary = normalize(article.summary), body = normalize(article.body);
      let score = 0;
      for (const word of words) {
        if (title.includes(word)) score += 10;
        else if (keywords.includes(word)) score += 7;
        else if (summary.includes(word)) score += 4;
        else if (body.includes(word)) score += 1;
        else return { article, score: -1 };
      }
      return { article, score };
    }).filter(result => result.score >= 0).sort((a, b) => b.score - a.score).map(result => result.article);
}
