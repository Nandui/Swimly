import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { HELP_CATEGORIES, type HelpArticle, type HelpScope } from "@/lib/help/types";
import { helpHref, type HelpFilters } from "@/lib/help/search";
import { summarizeArticle } from "@/lib/help/catalogue";
import { ArticleTools } from "./article-tools";
import { GuideScreenshot } from "./guide-screenshot";

export function HelpArticleView({ article, related, scope, filters, action }: {
  article: HelpArticle; related: HelpArticle[]; scope: HelpScope; filters: HelpFilters;
  action?: { href: string; label: string };
}) {
  const category = HELP_CATEGORIES.find(item => item.id === article.category)!;
  return <div className="space-y-6">
    <nav aria-label="Guide navigation" className="flex flex-wrap items-center gap-x-4 print:hidden"><Link href={helpHref(scope, undefined, filters)} className="inline-flex min-h-11 items-center gap-2 text-ui-muted-foreground underline-offset-4 hover:text-ui-foreground hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />{filters.q.trim() ? "Back to search results" : "All guides"}</Link><Link href={helpHref(scope, undefined, { q: "", topic: article.category })} className="inline-flex min-h-11 items-center text-ui-primary underline-offset-4 hover:underline">{category.title}</Link></nav>
    <div className="flex items-start gap-10">
      <article className="min-w-0 max-w-3xl flex-1 space-y-8">
        <header className="space-y-4"><div className="space-y-2"><h1 className="text-2xl font-semibold text-balance">{article.title}</h1><p className="max-w-prose leading-relaxed text-ui-muted-foreground">{article.summary}</p><p className="text-xs text-ui-muted-foreground">{summarizeArticle(article).minutes} min read · {scope === "instructor" ? "Instructor guide" : "Staff guide"}</p></div><ArticleTools /></header>
        <section id="before-you-start" aria-labelledby="before-heading" className="scroll-mt-6 space-y-3 rounded-ui-lg bg-ui-muted/50 p-4 lg:p-6"><h2 id="before-heading" className="font-semibold">Before you start</h2><ul className="list-disc space-y-2 pl-5 leading-relaxed">{article.before.map(item => <li key={item}>{item}</li>)}</ul>{action ? <Button asChild variant="outline" className="min-h-11 print:hidden"><Link href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.label} (opens in a new tab)`}>{action.label}<ExternalLink aria-hidden="true" /></Link></Button> : null}</section>
        <section id="steps" aria-labelledby="steps-heading" className="scroll-mt-6 space-y-5"><h2 id="steps-heading" className="text-xl font-semibold">Step by step</h2><ol className="space-y-6">{article.steps.map((step, index) => <li key={step.title} className="flex gap-4 break-inside-avoid"><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ui-border bg-ui-muted/50 font-semibold tabular-nums">{index + 1}</span><div className="min-w-0 space-y-2 pt-1"><h3 className="font-semibold">{step.title}</h3><p className="max-w-prose leading-relaxed">{step.text}</p>{step.screenshots?.map(screenshot => <GuideScreenshot key={screenshot.id} screenshot={screenshot} />)}</div></li>)}</ol></section>
        <section id="result" aria-labelledby="result-heading" className="scroll-mt-6 space-y-3 border-t border-ui-border pt-6"><h2 id="result-heading" className="text-xl font-semibold">What happens next</h2><p className="max-w-prose leading-relaxed">{article.result}</p></section>
        {article.troubleshooting.length ? <section id="troubleshooting" aria-labelledby="troubleshooting-heading" className="scroll-mt-6 space-y-4 border-t border-ui-border pt-6"><h2 id="troubleshooting-heading" className="text-xl font-semibold">If something isn’t right</h2><dl className="space-y-5">{article.troubleshooting.map(item => <div key={item.question} className="break-inside-avoid space-y-2"><dt className="font-semibold">{item.question}</dt><dd className="max-w-prose leading-relaxed text-ui-muted-foreground">{item.answer}</dd></div>)}</dl></section> : null}
        {related.length ? <section aria-labelledby="related-heading" className="space-y-3 border-t border-ui-border pt-6 print:hidden"><h2 id="related-heading" className="text-xl font-semibold">Related guides</h2><ul className="divide-y divide-ui-border">{related.map(item => <li key={item.slug}><Link href={helpHref(scope, item.slug)} className="flex min-h-11 items-center justify-between gap-3 py-3 font-medium text-ui-primary underline-offset-4 hover:underline">{item.title}<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>)}</ul></section> : null}
      </article>
      <nav aria-label="On this page" className="sticky top-6 hidden w-44 shrink-0 space-y-1 border-l border-ui-border pl-5 lg:block print:hidden"><p className="mb-2 font-semibold">On this page</p>{[["before-you-start", "Before you start"], ["steps", "Step by step"], ["result", "What happens next"], ...(article.troubleshooting.length ? [["troubleshooting", "Troubleshooting"]] : [])].map(([id, label]) => <a key={id} href={`#${id}`} className="flex min-h-11 items-center text-ui-muted-foreground underline-offset-4 hover:text-ui-foreground hover:underline">{label}</a>)}</nav>
    </div>
  </div>;
}
