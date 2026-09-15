import { CLASS_GUIDES } from "./guides-classes";
import { MANAGEMENT_GUIDES } from "./guides-management";
import { START_GUIDES } from "./guides-start";
import { SWIMMER_GUIDES } from "./guides-swimmers";
import { PARENT_GUIDES } from "./guides-parents";
import type { HelpArticle, HelpScope } from "./types";
import { screenshotsForStep } from "./screenshots";

export const HELP_ARTICLES: HelpArticle[] = [...START_GUIDES, ...SWIMMER_GUIDES, ...CLASS_GUIDES, ...MANAGEMENT_GUIDES, ...PARENT_GUIDES];

export function articlesForScope(scope: HelpScope): HelpArticle[] {
  return HELP_ARTICLES.filter(article => article.scopes.includes(scope)).map(article => ({
    ...article,
    steps: article.steps.filter(step => !step.scopes || step.scopes.includes(scope)).map(step => ({ ...step, screenshots: screenshotsForStep(article.slug, step.title, scope) })),
    related: article.related.filter(slug => HELP_ARTICLES.some(item => item.slug === slug && item.scopes.includes(scope))),
  }));
}

export type HelpSummary = Pick<HelpArticle, "slug" | "title" | "summary" | "category"> & {
  minutes: number;
  keywords: string;
  body: string;
};

export function summarizeArticle(article: HelpArticle): HelpSummary {
  const body = [article.summary, ...article.before, ...article.steps.flatMap(step => [step.title, step.text]), article.result,
    ...article.troubleshooting.flatMap(item => [item.question, item.answer])].join(" ");
  return { slug: article.slug, title: article.title, summary: article.summary, category: article.category,
    minutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)), keywords: article.keywords.join(" "), body };
}
