"use client";

import { useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Item } from "@/components/shadcn/item";
import { HELP_CATEGORIES, type HelpScope } from "@/lib/help/types";
import type { HelpSummary } from "@/lib/help/catalogue";
import { helpFilters, helpHref, searchHelp, type HelpFilters } from "@/lib/help/search";
import { cn } from "@/lib/utils";

const COMMON_TASKS = {
  desk: ["add-swimmer", "move-swimmer", "sibling-times", "cancel-class-session"],
  instructor: ["start-class", "take-attendance", "record-competencies", "saving-and-connection"],
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

  const topicButtons = <>
    <Button variant="ghost" onClick={() => change({ topic: "all" })} aria-pressed={filters.topic === "all"} className={cn("min-h-11 w-full justify-between whitespace-normal text-left", filters.topic === "all" && "bg-ui-accent text-ui-accent-foreground")}>
      All topics<span className="text-xs tabular-nums">{articles.length}</span>
    </Button>
    {categories.map(category => <Button key={category.id} variant="ghost" onClick={() => change({ topic: category.id })} aria-pressed={filters.topic === category.id} className={cn("min-h-11 w-full justify-between gap-2 whitespace-normal text-left", filters.topic === category.id && "bg-ui-accent text-ui-accent-foreground")}>
      {category.title}<span className="text-xs tabular-nums">{articles.filter(article => article.category === category.id).length}</span>
    </Button>)}
  </>;

  return <div className="space-y-8">
    <section aria-labelledby="help-title" className="space-y-4">
      <div className="space-y-2"><h1 id="help-title" className="text-2xl font-semibold">{scope === "instructor" ? "Help for your teaching day" : "What would you like to do?"}</h1><p className="max-w-2xl leading-relaxed text-ui-muted-foreground">{scope === "instructor" ? "Practical guides for starting a class, taking attendance and recording progress." : "Find a quick answer or follow a guide, from adding a swimmer to running the day’s classes."}</p></div>
      <form role="search" aria-label="Search the help centre" onSubmit={event => { event.preventDefault(); input.current?.focus(); }} className="max-w-2xl">
        <Label htmlFor="help-search" className="sr-only">Search help guides</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-4 size-5 text-ui-muted-foreground" /><Input ref={input} id="help-search" name="q" type="search" autoComplete="off" maxLength={160} value={filters.q} onChange={event => change({ q: event.target.value }, true)} placeholder={scope === "instructor" ? "Try ‘attendance’" : "Try ‘move a swimmer’"} className="h-13 pl-12 pr-12 [&::-webkit-search-cancel-button]:appearance-none" />
          {filters.q ? <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-11" aria-label="Clear search" onClick={() => { change({ q: "" }, true); input.current?.focus(); }}><X aria-hidden="true" /></Button> : null}
        </div>
      </form>
    </section>

    <div className="flex flex-col gap-6 md:flex-row lg:gap-10">
      <aside className="shrink-0 md:w-56 print:hidden">
        <nav aria-label="Help topics" className="hidden space-y-1 md:block"><h2 className="mb-3 px-4 text-sm font-semibold">Browse by topic</h2>{topicButtons}</nav>
        <Collapsible className="rounded-ui-lg border border-ui-border md:hidden">
          <CollapsibleTrigger asChild><Button variant="ghost" className="group h-auto min-h-11 w-full justify-between gap-3 rounded-ui-lg px-4 py-3 text-left whitespace-normal"><span>Browse by topic · {selectedCategory?.title ?? "All topics"}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 group-data-[state=open]:rotate-180" /></Button></CollapsibleTrigger>
          <CollapsibleContent><nav aria-label="Help topics" className="space-y-1 border-t border-ui-border p-2">{topicButtons}</nav></CollapsibleContent>
        </Collapsible>
      </aside>
      <div className="min-w-0 flex-1 space-y-8">
        {!searching && filters.topic === "all" ? <section aria-labelledby="common-tasks" className="rounded-ui-lg bg-ui-muted/50 p-4 lg:p-6">
          <h2 id="common-tasks" className="text-xl font-semibold">Common tasks</h2>
          <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">{common.map(article => <li key={article.slug}><Link href={helpHref(scope, article.slug)} className="group flex min-h-11 items-center justify-between gap-3 py-3 font-medium text-ui-primary underline-offset-4 hover:underline"><span>{article.title}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>)}</ul>
        </section> : null}
        <section aria-labelledby="results-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="results-heading" className="text-xl font-semibold">{searching ? "Search results" : selectedCategory?.title ?? "All guides"}</h2><p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-ui-muted-foreground">{results.length} {results.length === 1 ? "guide" : "guides"}{searching ? " found" : ""}</p></div>
          {selectedCategory ? <p className="text-ui-muted-foreground">{selectedCategory.description}</p> : null}
          {results.length ? <ul className="divide-y divide-ui-border border-y border-ui-border">{results.map(article => <li key={article.slug}>
            <Item asChild className="min-h-11 flex-nowrap items-start gap-3 px-2 py-5"><Link href={helpHref(scope, article.slug, filters)} className="group">
              <BookOpen aria-hidden="true" className="mt-1 hidden size-5 shrink-0 text-ui-muted-foreground sm:block" />
              <div className="min-w-0 flex-1 space-y-1"><h3 className="font-semibold text-ui-foreground group-hover:text-ui-primary">{article.title}</h3><p className="leading-relaxed text-ui-muted-foreground">{article.summary}</p><p className="pt-1 text-xs text-ui-muted-foreground">{HELP_CATEGORIES.find(category => category.id === article.category)?.title} · {article.minutes} min read</p></div>
              <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-ui-muted-foreground" />
            </Link></Item>
          </li>)}</ul> : <EmptyState title="No guides match this search"
            hint={`Try a shorter phrase, such as “enrol”, “attendance” or “password”.${filters.topic !== "all" ? " You can also search across all topics." : ""}`}
            action={<div className="flex flex-wrap justify-center gap-2">{filters.topic !== "all" ? <Button variant="outline" className="min-h-11" onClick={() => change({ topic: "all" })}>Search all topics</Button> : null}<Button variant="outline" className="min-h-11" onClick={() => { change({ q: "", topic: "all" }); input.current?.focus(); }}>Show all guides</Button></div>} />}
        </section>
      </div>
    </div>
  </div>;
}
