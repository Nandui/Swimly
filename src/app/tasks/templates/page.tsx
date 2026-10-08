import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { taskTemplates } from "@/lib/tasks/data";
import { TEMPLATE_STATUS_META, scheduleLabel, type TemplateStatus } from "@/lib/tasks/rules";

export const metadata: Metadata = { title: "Templates" };

const GROUPS: { status: TemplateStatus; title: string; empty: string }[] = [
  { status: "published", title: "Published", empty: "Nothing published yet" },
  { status: "draft", title: "Drafts", empty: "No drafts" },
  { status: "archived", title: "Archived", empty: "Nothing archived" },
];

/** The task templates: what each site's checks and logs ask for, where, for whom and when. */
export default async function TaskTemplatesPage() {
  const { templates, sites, roles } = await taskTemplates();
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  return (
    <>
      <PageHeader title="Templates" description="Each published template makes its tasks at its sites on the days its schedule says. Changing one never rewrites a task already made."
        actions={<Button asChild><Link href="/tasks/templates/new"><Plus aria-hidden="true" />New template</Link></Button>} />
      {templates.length === 0 ? (
        <section className="pc-panel" aria-label="Templates">
          <EmptyState icon="clipboardCheck" title="No templates yet" hint="Start with the checks a site does every day, such as opening checks or pool water readings." />
        </section>
      ) : GROUPS.map((g) => {
        const rows = templates.filter((t) => t.status === g.status);
        if (!rows.length && g.status === "archived") return null;
        return (
          <section key={g.status} className="pc-panel" aria-labelledby={`tpl-${g.status}`}>
            <div className="pc-panel-head"><h2 id={`tpl-${g.status}`}>{g.title} <span className="text-ui-muted-foreground tabular-nums">· {rows.length}</span></h2></div>
            {rows.length === 0 ? <EmptyState compact icon="clipboardCheck" title={g.empty} /> : (
              <ul className="pc-rows">
                {rows.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/templates/${t.id}`} className="pc-row">
                      <span className="pc-tile-icon" aria-hidden="true"><ClipboardCheck /></span>
                      <span className="pc-row-body">
                        <span className="pc-row-title">{t.title}</span>
                        <span className="pc-row-hint">{[
                          t.schedules.length ? t.schedules.map(scheduleLabel).join("; ") : "Added by hand",
                          t.siteIds.length ? t.siteIds.map((id) => siteName.get(id) ?? "Removed site").join(", ") : "Every site",
                          t.roleIds.length ? `for ${t.roleIds.map((id) => roleName.get(id) ?? "a removed role").join(", ")}` : null,
                          ...t.tags,
                        ].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="pc-row-trail">
                        <Tag meta={TEMPLATE_STATUS_META[t.status as TemplateStatus]} />
                        <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
