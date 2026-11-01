import Link from "next/link";
import { ChevronRight, CircleCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { FiguresFailed } from "@/components/home/figures-failed";
import { ACTION_ICONS } from "@/components/home/home-parts";
import { ModuleDay } from "@/components/workspace/module-day";
import type { HomeItem } from "@/modules/contributions";

export type OverviewGroup = { label: string; links: { href: string; label: string; description?: string; icon: LucideIcon }[] };

/** An app's starter page, the same shape in every app, as the approved Turnfin Glass canvas draws
 *  Swim school's: the app's name with the working site and today's date under it, its quick
 *  actions (the main one last, in blue); today's figures as tiles, with what waits for the person
 *  as the last (when there are figures; alone it would only repeat the list below); the day as lanes by place when the app has one, a block opening the Inspector;
 *  then what waits for the person, queue by queue, beside every page the app has with a line on
 *  what each is for. The items are the ones the app gives Home (`registerHomeCard`), so Home's
 *  counts and this page agree. Routes reach it through ModuleStart (module-start.tsx). */
export function ModuleOverview({ name, icon: Icon, siteName, today, now, items, groups, failed = false }: {
  name: string;
  icon: LucideIcon;
  siteName: string | null;
  /** Today's date as the line under the title says it: "Friday 24 October". */
  today: string;
  /** Minutes after midnight at the centre when the page was made. */
  now: number;
  items: HomeItem[];
  groups: OverviewGroup[];
  /** The app's figures failed to load (`loadModuleOverview`): say so in their place. */
  failed?: boolean;
}) {
  const actions = items.filter((i) => i.kind === "action");
  const figures = items.filter((i) => i.kind === "today");
  const schedule = items.find((i) => i.kind === "timeline" && i.sessions.length);
  // What needs the person first, then anything waiting, then the empty queues.
  const rank = (i: HomeItem) => (i.attention ? 0 : i.count ? 1 : 2);
  const waiting = items.filter((i) => !i.kind).sort((a, b) => rank(a) - rank(b));
  const waitingTotal = waiting.reduce((sum, i) => sum + (i.count ?? 0), 0);
  const needing = waiting.filter((i) => i.attention).length;
  // The app's first action is its main one: shown last, in blue.
  const ordered = [...actions].reverse();
  const buttons = ordered.map((action, index) => {
    const ActionIcon = action.icon ? ACTION_ICONS[action.icon] : null;
    return (
      <Button key={`${action.href}:${action.label}`} asChild variant={index === ordered.length - 1 ? "default" : "outline"}>
        <Link href={action.href}>{ActionIcon ? <ActionIcon aria-hidden="true" /> : null}{action.label}</Link>
      </Button>
    );
  });
  const pages = groups.filter((group) => group.links.length > 0);
  return (
    <PageShell spacing="roomy" header={<PageHeader title={name} description={siteName ? `${siteName} · ${today}` : today} actions={buttons.length ? buttons : undefined} />}>
      {failed ? <FiguresFailed /> : null}
      {figures.length ? (
        <ul className="pc-stats" aria-label="Today in figures">
          {figures.map((item) => (
            <li key={`${item.href}:${item.label}`} className="flex">
              <Link href={item.href} className="pc-stat w-full">
                <span className="text-(--label-2)">{item.label}</span>
                <span className="pc-stat-figure">{item.count}</span>
                {item.hint ? <span className={`text-footnote ${item.attention ? "text-(--orange-ink)" : "text-(--label-2)"}`}>{item.hint}</span> : null}
              </Link>
            </li>
          ))}
          {waiting.length ? (
            <li className="flex">
              <Link href="#overview-waiting" className="pc-stat w-full">
                <span className="text-(--label-2)">Waiting for you</span>
                <span className="pc-stat-figure">{waitingTotal}</span>
                <span className={`text-footnote ${needing ? "text-(--orange-ink)" : "text-(--label-2)"}`}>{needing ? `${needing} ${needing === 1 ? "list needs" : "lists need"} you` : "Nothing urgent"}</span>
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
      {schedule?.kind === "timeline" ? <ModuleDay title={schedule.label} href={schedule.href} linkLabel="Timetable" sessions={schedule.sessions} initialNow={now} /> : null}
      <div className={waiting.length ? "grid min-w-0 items-start gap-(--space-7) lg:grid-cols-2" : "flex min-w-0 flex-col"}>
        {waiting.length ? (
          <section aria-labelledby="overview-waiting-h" id="overview-waiting" className="flex min-w-0 flex-col">
            <div className="pc-section-head"><h2 id="overview-waiting-h">Waiting for you</h2>{waitingTotal ? <p>{waitingTotal}</p> : null}</div>
            <ul className="pc-list">
              {waiting.map((item) => (
                <li key={`${item.href}:${item.label}`}>
                  <Link href={item.href} className="pc-row">
                    <span className="pc-tile-icon" data-tone={item.attention ? "orange" : item.count ? undefined : "green"}>{item.count ? <Icon aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}</span>
                    <span className="pc-row-body"><span>{item.label}</span>{item.hint ? <span className="pc-row-hint">{item.hint}</span> : null}</span>
                    <span className="pc-row-value">{item.count}</span>
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="overview-pages" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="overview-pages">Everything in {name}</h2></div>
          {pages.length ? (
            <div className="flex min-w-0 flex-col gap-(--space-5)">
              {pages.map((group) => (
                <div key={group.label || "pages"} className="flex min-w-0 flex-col gap-(--space-2)">
                  {group.label ? <h3 className="mx-(--space-1) text-footnote font-semibold text-(--label-2)">{group.label}</h3> : null}
                  <ul className="pc-list">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="pc-row">
                          <span className="pc-tile-icon"><link.icon aria-hidden="true" /></span>
                          <span className="pc-row-body"><span>{link.label}</span>{link.description ? <span className="pc-row-hint">{link.description}</span> : null}</span>
                          <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="pc-list"><EmptyState as="h3" icon="layers" title={`Nothing to open at ${siteName ?? "this site"}`} hint="Switch site or ask your manager" /></div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
