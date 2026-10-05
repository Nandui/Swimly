"use client";

import { useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, BookOpen, CalendarX, ChevronDown, ChevronRight, ClipboardCheck, ListChecks, PlayCircle, Search, UserPlus, UserX, Wifi, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { HELP_CATEGORIES, type HelpScope } from "@/lib/help/types";
import type { HelpSummary } from "@/lib/help/catalogue";
import { clause, helpFilters,helpHref, searchHelp, type HelpFilters } from "@/lib/help/search";

const COMMON_TASKS = {
  desk: ["move-swimmer", "cancel-class-session", "book-assessment", "report-absence"],
  instructor: ["start-class", "take-attendance", "record-competencies", "saving-and-connection"],
};
const TASK_ICONS: Record<string, LucideIcon> = {
  "move-swimmer": ArrowLeftRight, "cancel-class-session": CalendarX, "book-assessment": ClipboardCheck, "report-absence": UserX,
  "add-swimmer": UserPlus, "start-class": PlayCircle, "take-attendance": ListChecks, "record-competencies": ClipboardCheck, "saving-and-connection": Wifi,
};

export function HelpBrowser({ articles, scope }: { articles: HelpSummary[]; scope: HelpScope }) {
  const params = useSearchParams();
  const filters = helpFilters(params.get("q"), params.get("topic"));
  const input = useRef<HTMLInputElement>(null);
  const categories = HELP_CATEGORIES.filter(category => articles.some(article => article.category === category.id));
  // A desk-only topic copied into an Instructor URL must not leave the topic control without a value.
  if (!categories.some(category => category.id === filters.topic)) filters.topic = "all";
  const results = searchHelp(articles, filters);
  const searching = Boolean(filters.q.trim());
  const selectedCategory = categories.find(category => category.id === filters.topic);
  const common = COMMON_TASKS[scope].flatMap(slug => articles.find(article => article.slug === slug) ?? []);

  function change(next: Partial<HelpFilters>, replace = false) {
    const value = { ...filters, ...next };
    // Keep a trailing space while typing; only canonical links trim it.
    const url = new URL(helpHref(scope, undefined, value), window.location.origin);
    if (value.q) url.searchParams.set("q", value.q.slice(0, 160));
    window.history[replace ? "replaceState" : "pushState"](null, "", `${url.pathname}${url.search}`);
  }

  const topicRow = (id: HelpFilters["topic"], title: string, count: number) => {
    const selected = filters.topic === id;
    return <li key={id}><Link href={helpHref(scope, undefined, { ...filters, topic: id })} scroll={false} aria-current={selected ? "true" : undefined} className="pc-row">
      <span className="pc-row-body pc-row-title">{title}</span>
      <span className="pc-row-trail"><span className="pc-row-count">{count}</span><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
    </Link></li>;
  };
  const topicRows = <ul className="pc-rows" data-size="compact">
    {topicRow("all", "All topics", articles.length)}
    {categories.map(category => topicRow(category.id, category.title, articles.filter(article => article.category === category.id).length))}
  </ul>;

  return <>
    <div className="flex min-w-0 flex-col gap-1">
      <h1 id="help-title">{scope === "instructor" ? "Help for your teaching day" : "What would you like to do?"}</h1>
      <p className="text-sm text-ui-muted-foreground">{scope === "instructor" ? "Practical guides for starting a class, taking attendance and recording progress" : "Step-by-step guides for every part of Turnfin"}</p>
    </div>
    <form role="search" aria-label="Search the help centre" onSubmit={event => { event.preventDefault(); input.current?.focus(); }} className="pc-panel">
      <div className="flex max-w-xl flex-col gap-2">
        <Label htmlFor="help-search">Search the guides</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ui-muted-foreground" /><Input ref={input} id="help-search" name="q" type="search" autoComplete="off" maxLength={160} value={filters.q} onChange={event => change({ q: event.target.value }, true)} placeholder={scope === "instructor" ? "Try ‘attendance’" : "Try ‘move a swimmer’"} className="pl-12 pr-12 [&::-webkit-search-cancel-button]:appearance-none" />
          {filters.q ? <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11" aria-label="Clear search" onClick={() => { change({ q: "" }, true); input.current?.focus(); }}><X aria-hidden="true" /></Button> : null}
        </div>
      </div>
    </form>

    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <aside className="shrink-0 md:w-64 print:hidden">
        <nav aria-labelledby="browse-by-topic" className="pc-panel pc-only-wide"><h2 id="browse-by-topic" className="text-lg">Browse by topic</h2>{topicRows}</nav>
        <Collapsible className="pc-only-narrow flex-col rounded-ui-xl bg-ui-card">
          <CollapsibleTrigger asChild><Button variant="ghost" className="group h-auto min-h-11 w-full justify-between gap-3 rounded-ui-xl px-4 py-3 text-left whitespace-normal"><span>Browse by topic · {selectedCategory?.title ?? "All topics"}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 group-data-[state=open]:rotate-180" /></Button></CollapsibleTrigger>
          <CollapsibleContent><nav aria-label="Help topics" className="px-4 pb-4">{topicRows}</nav></CollapsibleContent>
        </Collapsible>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {!searching && filters.topic === "all" && common.length ? <section aria-labelledby="common-tasks" className="pc-panel">
          <h2 id="common-tasks" className="text-lg">Common tasks</h2>
          <ul className="pc-rows pc-rows-grid">{common.map(article => {
            const Icon = TASK_ICONS[article.slug] ?? BookOpen;
            return <li key={article.slug} className="flex"><Link href={helpHref(scope, article.slug)} className="pc-row flex-1"><span className="pc-tile-icon"><Icon aria-hidden="true" /></span><span className="pc-row-body pc-row-title">{article.title}</span><ChevronRight aria-hidden="true" className="pc-row-chevron" /></Link></li>;
          })}</ul>
        </section> : null}
        <section aria-labelledby="results-heading" className="pc-panel">
          <div className="flex flex-col gap-1"><h2 id="results-heading" className="text-lg">{searching ? "Search results" : selectedCategory?.title ?? "All guides"}</h2><p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-ui-muted-foreground">{results.length} {results.length === 1 ? "guide" : "guides"}{searching ? " found" : ""}{selectedCategory && !searching ? ` · ${clause(selectedCategory.description)}` : ""}</p></div>
          {results.length ? <ul className="pc-rows">{results.map(article => <li key={article.slug}>
            <Link href={helpHref(scope, article.slug, filters)} className="pc-row">
              <span className="pc-row-body"><span className="pc-row-title">{article.title}</span><span className="pc-row-hint">{`${clause(article.summary)} · ${HELP_CATEGORIES.find(category => category.id === article.category)?.title} · ${article.minutes} min read`}</span></span>
              <ChevronRight aria-hidden="true" className="pc-row-chevron" />
            </Link>
          </li>)}</ul> : <EmptyState title="No guides match this search"
            hint={`Try a shorter phrase or another word for the task.${filters.topic !== "all" ? " You can also search across all topics." : ""}`}
            action={<div className="flex flex-wrap justify-center gap-2">{filters.topic !== "all" ? <Button variant="outline" onClick={() => change({ topic: "all" })}>Search all topics</Button> : null}<Button variant="outline" onClick={() => { change({ q: "", topic: "all" }); input.current?.focus(); }}>Show all guides</Button></div>} />}
        </section>
      </div>
    </div>
  </>;
}
