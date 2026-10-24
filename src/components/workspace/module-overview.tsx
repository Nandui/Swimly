import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { FiguresFailed } from "@/components/home/figures-failed";
import { ACTION_ICONS, NeedsSummary, PageList, Section, Timeline, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";
import { minutesNow } from "@/lib/format";
import type { HomeItem } from "@/modules/contributions";

export type OverviewGroup = { label: string; links: { href: string; label: string; description?: string; icon: LucideIcon }[] };

/** A module's starter page, the same shape in every module: its
 *  quick actions in the header (the main one last, in blue), the day at a glance on a timeline
 *  when the module has one (the swim school's classes), today's figures and what waits for this
 *  person side by side, and every page it has with a line on what each is for. The items are
 *  the ones the module gives Home (`registerHomeCard`), so Home's counts and this page agree.
 *  Routes reach it through ModuleStart (module-start.tsx). */
export function ModuleOverview({ name, description, icon, siteName, items, groups, failed = false }: {
  name: string;
  description: string;
  icon: LucideIcon;
  siteName: string | null;
  items: HomeItem[];
  groups: OverviewGroup[];
  /** The module's figures failed to load (`loadModuleOverview`): say so in their place. */
  failed?: boolean;
}) {
  const placed: Placed[] = items.map((item) => ({ ...item, moduleIcon: icon, key: `${item.href}:${item.label}` }));
  const { actions, today, timeline, waiting } = sortItems(placed);
  // The summary counts only the rows it sits beside.
  const needing = waiting.filter((i) => i.attention).length;
  // The module's first action is its main one: shown last, in blue.
  const ordered = [...actions].reverse();
  const buttons = ordered.map((action, index) => {
    const Icon = action.icon ? ACTION_ICONS[action.icon] : null;
    return (
      <Button key={action.key} asChild variant={index === ordered.length - 1 ? "default" : "outline"}>
        <Link href={action.href}>{Icon ? <Icon aria-hidden="true" /> : null}{action.label}</Link>
      </Button>
    );
  });
  const schedule = timeline[0];
  const sessions = schedule?.kind === "timeline" ? schedule.sessions : [];
  // Below 1280px the timeline is the list of what is still on; with nothing left it is not shown.
  const left = sessions.some((s) => s.state !== "done" && s.state !== "off");
  const pages = groups.filter((group) => group.links.length > 0);
  return (
    <PageShell header={<PageHeader title={name} description={description} actions={buttons.length ? buttons : undefined} />}>
      {failed ? <FiguresFailed /> : null}
      {schedule && (
        // Below 1280px the grid becomes the list of what is on now and next, and says so.
        <Section id="overview-timeline" wideOnly={!left}
          title={<><span className="pc-timeline-wide-only">{schedule.label}</span><span className="pc-timeline-narrow-only">On now and next</span></>}
          aside={<Button asChild variant="ghost"><Link href={schedule.href}><span className="pc-timeline-wide-only">Open schedule</span><span className="pc-timeline-narrow-only">Schedule</span><ChevronRight aria-hidden="true" /></Link></Button>}>
          <Timeline sessions={sessions} now={minutesNow()} />
        </Section>
      )}
      {(today.length > 0 || waiting.length > 0) && (
        <div className="pc-grid">
          {today.length > 0 && (
            <Section id="overview-today" title={siteName ? `Today at ${siteName}` : "Today"}>
              <TodayGrid items={today} />
            </Section>
          )}
          {waiting.length > 0 && (
            <Section id="overview-waiting" title="Waiting for you" aside={<NeedsSummary count={needing} />}>
              <WaitingList items={waiting} />
            </Section>
          )}
        </div>
      )}
      <Section id="overview-pages" title={`Everything in ${name}`}>
        {pages.length ? <PageList groups={pages} /> : (
          <EmptyState as="h3" icon="layers" title={`Nothing to open at ${siteName ?? "this site"}`} hint="Switch site or ask your manager" />
        )}
      </Section>
    </PageShell>
  );
}
