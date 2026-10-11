import Link from "next/link";
import { ChevronRight, Smartphone } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { FiguresFailed } from "@/components/home/figures-failed";
import { NeedsSummary } from "@/components/home/home-parts";
import { HOME_ITEM_META } from "@/lib/home-meta";
import { groupModules, type ModuleManifest } from "@/modules/registry";
import type { HomeItem } from "@/modules/contributions";

/** What needs the person in one module, as Home shows it: the queues' names and counts. */
type Waiting = { label: string; count: number };

/** One group's panel: the group's name and its modules as rows. */
type Group = { label: string; modules: readonly ModuleManifest[] };

/** Home, the hub (DESIGN.md, "Poolside Clear v2"): the modules this person's role opens, one
 *  white panel per module group, the panels in two balanced columns from 1024px. Each module
 *  row has its icon, name and registry description, and, when something in it needs the
 *  person, a "N need you" tag and the names of up to two of those queues, so the row says
 *  what is waiting before it is opened. Opening one goes to the module's starter page (its
 *  manifest's `href`), which lists the queues. The note says their own things are in Turnfin
 *  Me. Showing a module is presentation; every module page checks its permission again. */
export function HomeView({ homeName, roleName, siteName, today, modules, items, failed = [], meUrl = null }: {
  homeName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  modules: readonly ModuleManifest[];
  /** Each module's items for this person (`registerHomeCard`): Home shows what needs them. */
  items: ReadonlyMap<string, HomeItem[]>;
  /** Modules whose figures failed to load: a notice says so, as their counts are missing. */
  failed?: readonly string[];
  /** Turnfin Me's address when the staff API is set up; the note links there. */
  meUrl?: string | null;
}) {
  const waiting = (id: string): Waiting[] => (items.get(id) ?? [])
    .filter((item) => item.attention && item.kind !== "action" && item.kind !== "timeline")
    .map((item) => ({ label: item.label, count: item.count ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const needs = (id: string) => (items.get(id) ?? []).filter((item) => item.attention).length;
  const needing = modules.reduce((sum, mod) => sum + needs(mod.id), 0);
  const groups = groupModules(modules);
  const columns = balance(groups);
  const missing = modules.filter((mod) => failed.includes(mod.id)).map((mod) => mod.name);
  const where = siteName ? `${roleName} at ${siteName}` : roleName;
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
  const panel = (group: Group) => (
    <ModuleGroup key={group.label} group={group} wide={groups.length === 1} needs={needs} waiting={waiting} />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={homeName} description={`${today} · ${where}`} actions={modules.length ? <NeedsSummary count={needing} /> : undefined} />

      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no modules yet. Ask an admin to give it a level in the modules you need." />
      ) : (
        <>
          {missing.length > 0 ? <FiguresFailed modules={missing} /> : null}
          {columns.length === 1 ? panel(columns[0][0]) : (
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
              {columns.map((column, i) => (
                <div key={i} className="flex min-w-0 flex-col gap-4">{column.map(panel)}</div>
              ))}
            </div>
          )}
          {meNote}
        </>
      )}
    </div>
  );
}

/** The groups split into two columns of about the same number of modules, keeping the module
 *  bar's order down the left column and then the right. One group stays one full-width panel. */
function balance(groups: readonly Group[]): Group[][] {
  if (groups.length < 2) return groups.length ? [[...groups]] : [];
  const half = Math.ceil(groups.reduce((sum, g) => sum + g.modules.length, 0) / 2);
  const left: Group[] = [];
  let count = 0;
  for (const group of groups) {
    if (left.length && (count + group.modules.length > half || left.length === groups.length - 1)) break;
    left.push(group);
    count += group.modules.length;
  }
  return [left, groups.slice(left.length)];
}

/** A group's white panel: its name as the section title, then a row per module. */
function ModuleGroup({ group, wide, needs, waiting }: {
  group: Group;
  /** The only group on the page: its rows go two or three across instead of one column. */
  wide: boolean;
  needs: (id: string) => number;
  waiting: (id: string) => Waiting[];
}) {
  const id = `home-group-${group.label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="pc-panel">
      <h2 id={id} className="text-lg font-semibold">{group.label}</h2>
      <ul className={wide ? "pc-rows pc-rows-grid" : "pc-rows"}>
        {group.modules.map((mod) => {
          const count = needs(mod.id);
          const queues = waiting(mod.id);
          return (
            <li key={mod.id} className="flex">
              <Link href={mod.href} className="pc-row w-full">
                <span className="pc-tile-icon"><mod.icon aria-hidden="true" /></span>
                <span className="pc-row-body gap-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="pc-row-title">{mod.name}</span>
                    {count ? <Tag meta={HOME_ITEM_META.attention} label={`${count} ${count === 1 ? "needs" : "need"} you`} /> : null}
                  </span>
                  <span className="pc-row-hint">{mod.description}</span>
                  {queues.length ? (
                    <span className="mt-1 flex flex-col text-xs">
                      {queues.slice(0, 2).map((queue) => (
                        <span key={queue.label}>{queue.label} <span className="font-bold tabular-nums">{queue.count}</span></span>
                      ))}
                      {queues.length > 2 ? <span className="text-ui-muted-foreground">and {queues.length - 2} more</span> : null}
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden="true" className="pc-row-chevron" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
