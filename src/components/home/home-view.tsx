import { Smartphone } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { FiguresFailed } from "@/components/home/figures-failed";
import { groupModules, type ModuleManifest } from "@/modules/registry";
import type { HomeItem } from "@/modules/contributions";
import { NeedsSummary, PageList, Section } from "@/components/home/home-parts";

/** Home, the hub (DESIGN.md, "Poolside Clear v2"): the modules this person's role opens, under
 *  their group headings, each with a line on what it is for and how many things in it need
 *  them. Opening one goes to the module's starter page (its manifest's `href`), which carries
 *  the module's day, queues and pages. The note says their own things are in Turnfin Me.
 *  Showing a module is presentation; every module page checks its permission again. */
export function HomeView({ homeName, roleName, siteName, today, modules, items, failed = [], meUrl = null }: {
  homeName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  modules: readonly ModuleManifest[];
  /** Each module's items for this person (`registerHomeCard`): Home counts what needs them. */
  items: ReadonlyMap<string, HomeItem[]>;
  /** Modules whose figures failed to load: a notice says so, as their counts are missing. */
  failed?: readonly string[];
  /** Turnfin Me's address when the staff API is set up; the note links there. */
  meUrl?: string | null;
}) {
  const needs = (id: string) => (items.get(id) ?? []).filter((item) => item.attention).length;
  const needing = modules.reduce((sum, mod) => sum + needs(mod.id), 0);
  const groups = groupModules(modules).map((group) => ({
    label: group.label,
    links: group.modules.map((mod) => ({ href: mod.href, label: mod.name, description: mod.description, icon: mod.icon, attention: needs(mod.id) })),
  }));
  const missing = modules.filter((mod) => failed.includes(mod.id)).map((mod) => mod.name);
  const note = (
    <>
      <Smartphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-primary" />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">Your own things are in Turnfin Me</span>
        <span className="text-xs text-ui-muted-foreground">Training, reading, shifts and HR, on your phone.</span>
      </span>
    </>
  );
  const meNote = meUrl ? <a href={meUrl} className="pc-note" target="_blank" rel="noopener noreferrer">{note}<span className="sr-only"> (opens in a new tab)</span></a> : <div className="pc-note">{note}</div>;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={homeName} description={[today, roleName, siteName].filter(Boolean).join(" · ")} actions={modules.length ? <NeedsSummary count={needing} /> : undefined} />

      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no modules yet. Ask an admin to give it a level in the modules you need." />
      ) : (
        <>
          {missing.length > 0 ? <FiguresFailed modules={missing} /> : null}
          <Section id="home-modules" title="Your modules">
            <PageList groups={groups} />
          </Section>
          {meNote}
        </>
      )}
    </div>
  );
}
