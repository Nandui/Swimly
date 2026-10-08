import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Download, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { ArchiveTemplate, CopyTemplate } from "@/components/tasks/template-actions";
import { taskTemplates } from "@/lib/tasks/data";
import { TEMPLATE_KIND_SHORT, TEMPLATE_STATUS_META, scheduleLabel, type TemplateStatus } from "@/lib/tasks/rules";

export const metadata: Metadata = { title: "Manage tasks" };

const STATES = { all: "All states", published: "Published", draft: "Draft", archived: "Archived" } as const;

/** The task library (the prototype's Manage tasks): every template with how it is made, its
 *  sites and tags, filtered by words, state and tag; open one to change it, or copy or archive
 *  it from its row. */
export default async function TaskTemplatesPage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string; tag?: string }> }) {
  const { templates, sites, roles, filters, tags, total } = await taskTemplates(await searchParams);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const filtered = !!(filters.q || filters.tag || filters.state !== "all");
  return (
    <>
      <PageHeader title="Manage tasks" description="Build, schedule and assign the work that keeps your sites running. Changing a template never rewrites a task already made."
        actions={<>
          <Button asChild variant="outline"><a href="/tasks/export.json"><Download aria-hidden="true" />Export everything</a></Button>
          <Button asChild><Link href="/tasks/templates/new"><Plus aria-hidden="true" />Create task</Link></Button>
        </>} />
      <section className="pc-panel" aria-labelledby="tpl-library">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1"><h2 id="tpl-library">Task library <span className="text-ui-muted-foreground tabular-nums">· {templates.length}{filtered ? ` of ${total}` : ""}</span></h2><p className="pc-row-hint">Reusable routines, built for your team.</p></div>
        </div>
        <form method="get" role="search" aria-label="Filter the library" className="flex flex-wrap items-end gap-4">
          <SearchField label="Find a task" placeholder="Title or tag" name="q" defaultValue={filters.q} className="grow basis-56" />
          <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-40"><Label htmlFor="tpl-state" className="block">State</Label>
            <NativeSelect id="tpl-state" name="state" defaultValue={filters.state} className="min-h-11 w-full">
              {Object.entries(STATES).map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}
            </NativeSelect></div>
          <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-40"><Label htmlFor="tpl-tag" className="block">Tag</Label>
            <NativeSelect id="tpl-tag" name="tag" defaultValue={filters.tag} className="min-h-11 w-full">
              <NativeSelectOption value="">All tags</NativeSelectOption>
              {tags.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
            </NativeSelect></div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">Apply</Button>
            {filtered ? <Button asChild variant="ghost"><Link href="/tasks/templates">Reset</Link></Button> : null}
          </div>
        </form>
        {templates.length === 0 ? (
          <EmptyState compact icon="clipboardCheck" title={total ? "No template matches" : "No templates yet"}
            hint={total ? "Try another filter." : "Start with the checks a site does every day, such as opening checks or pool water readings."} />
        ) : (
          <ul className="pc-rows">
            {templates.map((t) => (
              <li key={t.id} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true"><ClipboardList /></span>
                <Link href={`/tasks/templates/${t.id}`} className="pc-row-body underline-offset-4 hover:[&_.pc-row-title]:underline">
                  <span className="pc-row-title">{t.title}</span>
                  <span className="pc-row-hint">{[
                    t.kind === "repeat" || t.kind === "once" ? (t.schedules.length ? t.schedules.map(scheduleLabel).join("; ") : "No schedule yet") : TEMPLATE_KIND_SHORT[t.kind],
                    t.siteIds.length ? t.siteIds.map((id) => siteName.get(id) ?? "Removed site").join(", ") : "Every site",
                    t.roleIds.length ? `${t.restricted ? "only " : "for "}${t.roleIds.map((id) => roleName.get(id) ?? "a removed role").join(", ")}` : null,
                    ...t.tags, t.priority ? "High priority" : null,
                  ].filter(Boolean).join(" · ")}</span>
                </Link>
                <span className="pc-row-trail">
                  <Tag meta={TEMPLATE_STATUS_META[t.status as TemplateStatus]} />
                  <CopyTemplate id={t.id} compact />
                  <ArchiveTemplate id={t.id} archived={t.status === "archived"} compact />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
