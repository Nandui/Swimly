import Link from "next/link";
import { ChevronRight, CircleHelp, ExternalLink } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import type { HelpArticle, HelpScope } from "@/lib/help/types";
import { clause, helpHref, type HelpFilters } from "@/lib/help/search";
import { summarizeArticle } from "@/lib/help/catalogue";
import { ArticleTools } from "./article-tools";
import { GuideScreenshot } from "./guide-screenshot";

export function HelpArticleView({ article, related, scope, filters, action }: {
  article: HelpArticle; related: HelpArticle[]; scope: HelpScope; filters: HelpFilters;
  action?: { href: string; label: string };
}) {
  const contents = [["before-you-start", "Before you start"], ["steps", "Step by step"], ["result", "What happens next"], ...(article.troubleshooting.length ? [["troubleshooting", "If something isn’t right"]] : [])];
  return <article className="flex min-w-0 flex-col gap-4">
    <PageHeader
      back={{ href: helpHref(scope, undefined, filters), label: filters.q.trim() ? "Search results" : "All guides" }}
      title={article.title}
      description={`${clause(article.summary)} · ${summarizeArticle(article).minutes} min read · ${scope === "instructor" ? "Instructor guide" : "Staff guide"}`}
      actions={<ArticleTools />}
    />
    <div className="flex items-start gap-4">
      <div className="pc-panel min-w-0 flex-1 gap-8 lg:p-8">
        <section id="before-you-start" aria-labelledby="before-heading" className="pc-note scroll-mt-6">
          <CircleHelp aria-hidden="true" className="size-5 shrink-0 text-ui-primary" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 id="before-heading" className="text-sm">Before you start</h2>
            <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5">{article.before.map(item => <li key={item}>{item}</li>)}</ul>
            {action ? <Button asChild variant="outline" className="self-start print:hidden"><Link href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.label} (opens in a new tab)`}>{action.label}<ExternalLink aria-hidden="true" /></Link></Button> : null}
          </div>
        </section>
        <section id="steps" aria-labelledby="steps-heading" className="flex scroll-mt-6 flex-col gap-4"><h2 id="steps-heading">Step by step</h2>
          <ol className="pc-rows">{article.steps.map((step, index) => <li key={step.title} className="pc-note break-inside-avoid">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ui-primary text-xs font-semibold tabular-nums text-ui-primary-foreground">{index + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1"><h3>{step.title}</h3><p className="max-w-prose">{step.text}</p>{step.screenshots?.map(screenshot => <GuideScreenshot key={screenshot.id} screenshot={screenshot} />)}</div>
          </li>)}</ol>
        </section>
        <section id="result" aria-labelledby="result-heading" className="flex scroll-mt-6 flex-col gap-2"><h2 id="result-heading">What happens next</h2><p className="max-w-prose">{article.result}</p></section>
        {article.troubleshooting.length ? <section id="troubleshooting" aria-labelledby="troubleshooting-heading" className="flex scroll-mt-6 flex-col gap-4"><h2 id="troubleshooting-heading">If something isn’t right</h2><dl className="flex flex-col gap-4">{article.troubleshooting.map(item => <div key={item.question} className="flex break-inside-avoid flex-col gap-1"><dt className="font-semibold">{item.question}</dt><dd className="max-w-prose text-ui-muted-foreground">{item.answer}</dd></div>)}</dl></section> : null}
        {related.length ? <section aria-labelledby="related-heading" className="flex flex-col gap-4 print:hidden"><h2 id="related-heading">Related guides</h2><ul className="pc-rows">{related.map(item => <li key={item.slug}><Link href={helpHref(scope, item.slug)} className="pc-row"><span className="pc-row-body pc-row-title">{item.title}</span><ChevronRight aria-hidden="true" className="pc-row-chevron" /></Link></li>)}</ul></section> : null}
      </div>
      <div className="sticky top-6 hidden w-56 shrink-0 self-start lg:block print:hidden">
        <nav aria-labelledby="on-this-page" className="pc-panel"><h2 id="on-this-page" className="text-lg">On this page</h2>
          <ul className="pc-rows" data-size="compact">{contents.map(([id, label]) => <li key={id}><a href={`#${id}`} className="pc-row pc-row-title">{label}</a></li>)}</ul>
        </nav>
      </div>
    </div>
  </article>;
}
