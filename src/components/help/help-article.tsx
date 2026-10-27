import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
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
  return <article className="min-w-0">
    <PageShell spacing="roomy" header={<PageHeader
      back={{ href: helpHref(scope, undefined, filters), label: filters.q.trim() ? "Search results" : "All guides" }}
      title={article.title}
      description={`${clause(article.summary)} · ${summarizeArticle(article).minutes} min read · ${scope === "instructor" ? "Instructor guide" : "Staff guide"}`}
      actions={<ArticleTools />}
    />}>
    <div className="flex items-start gap-(--space-7)">
      <div className="flex min-w-0 flex-1 flex-col gap-(--space-7)">
        <section id="before-you-start" aria-labelledby="before-heading" className="flex min-w-0 scroll-mt-6 flex-col">
          <div className="pc-section-head"><h2 id="before-heading">Before you start</h2></div>
          <div className="rec-card">
            {article.before.length === 1
              ? <p className="max-w-prose">{article.before[0]}</p>
              : <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5">{article.before.map(item => <li key={item}>{item}</li>)}</ul>}
            {action ? <Button asChild variant="outline" className="self-start print:hidden"><Link href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.label} (opens in a new tab)`}>{action.label}<ExternalLink aria-hidden="true" /></Link></Button> : null}
          </div>
        </section>
        <section id="steps" aria-labelledby="steps-heading" className="flex min-w-0 scroll-mt-6 flex-col">
          <div className="pc-section-head"><h2 id="steps-heading">Step by step</h2></div>
          <ol className="rec-card">{article.steps.map((step, index) => <li key={step.title} className="flex break-inside-avoid gap-3">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--accent-btn) text-xs font-semibold tabular-nums text-ui-primary-foreground">{index + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1"><h3>{step.title}</h3><p className="max-w-prose">{step.text}</p>{step.screenshots?.map(screenshot => <GuideScreenshot key={screenshot.id} screenshot={screenshot} />)}</div>
          </li>)}</ol>
        </section>
        <section id="result" aria-labelledby="result-heading" className="flex min-w-0 scroll-mt-6 flex-col">
          <div className="pc-section-head"><h2 id="result-heading">What happens next</h2></div>
          <div className="rec-card"><p className="max-w-prose">{article.result}</p></div>
        </section>
        {article.troubleshooting.length ? <section id="troubleshooting" aria-labelledby="troubleshooting-heading" className="flex min-w-0 scroll-mt-6 flex-col">
          <div className="pc-section-head"><h2 id="troubleshooting-heading">If something isn’t right</h2></div>
          <dl className="rec-card">{article.troubleshooting.map(item => <div key={item.question} className="flex break-inside-avoid flex-col gap-1"><dt className="font-semibold">{item.question}</dt><dd className="max-w-prose text-ui-muted-foreground">{item.answer}</dd></div>)}</dl>
        </section> : null}
        {related.length ? <section aria-labelledby="related-heading" className="flex min-w-0 flex-col print:hidden">
          <div className="pc-section-head"><h2 id="related-heading">Related guides</h2></div>
          <ul className="pc-list">{related.map(item => <li key={item.slug}><Link href={helpHref(scope, item.slug)} className="pc-row"><span className="pc-row-body pc-row-title">{item.title}</span><ChevronRight aria-hidden="true" className="pc-row-chevron" /></Link></li>)}</ul>
        </section> : null}
      </div>
      <div className="sticky top-6 hidden w-56 shrink-0 self-start lg:block print:hidden">
        <nav aria-labelledby="on-this-page" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="on-this-page">On this page</h2></div>
          <ul className="pc-list">{contents.map(([id, label]) => <li key={id}><a href={`#${id}`} className="pc-row pc-row-title">{label}</a></li>)}</ul>
        </nav>
      </div>
    </div>
  </PageShell>
</article>;
}
