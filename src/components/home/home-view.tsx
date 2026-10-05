import Link from "next/link";
import { ChevronRight, Smartphone } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { FiguresFailed } from "@/components/home/figures-failed";
import { minutesNow } from "@/lib/format";
import type { ModuleManifest } from "@/modules/registry";
import type { HomeItem } from "@/modules/contributions";
import { NeedsSummary, QuickActions, Section, Timeline, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";

/** A role's home page (DESIGN.md, "Poolside Clear v2"): the day at a glance on a timeline, then
 *  what waits for this person, today's figures and the quick actions, with the note that their
 *  own things are in Turnfin Me. Modules supply every item (`registerHomeCard`); each module's
 *  own overview carries the rest, and the module bar is the way into each module. */
export function HomeView({ homeName, roleName, siteName, today, modules, items, failed = [], meUrl = null }: {
  homeName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  modules: readonly ModuleManifest[];
  items: ReadonlyMap<string, HomeItem[]>;
  /** Modules whose figures failed to load: a notice says so in place of their panels. */
  failed?: readonly string[];
  /** Turnfin Me's address when the staff API is set up; the note links there. */
  meUrl?: string | null;
}) {
  const placed: Placed[] = modules.flatMap((mod) => (items.get(mod.id) ?? []).map((item) => ({ ...item, moduleIcon: mod.icon, key: `${mod.id}:${item.label}` })));
  const { actions, today: todayFacts, timeline, waiting } = sortItems(placed);
  const needing = [...waiting, ...todayFacts].filter((i) => i.attention).length;
  const sessions = timeline.flatMap((t) => t.kind === "timeline" ? t.sessions : []);
  // Below 1280px the timeline is the list of what is still on; with nothing left it is not shown.
  const left = sessions.some((s) => s.state !== "done" && s.state !== "off");
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
          {sessions.length > 0 && (
            // Below 1280px the grid becomes the list of what is on now and next, and says so.
            <Section id="home-timeline" wideOnly={!left}
              title={<><span className="pc-timeline-wide-only">{timeline[0].label}</span><span className="pc-timeline-narrow-only">On now and next</span></>}
              aside={<Button asChild variant="ghost"><Link href={timeline[0].href}><span className="pc-timeline-wide-only">Open schedule</span><span className="pc-timeline-narrow-only">Schedule</span><ChevronRight aria-hidden="true" /></Link></Button>}>
              <Timeline sessions={sessions} now={minutesNow()} />
            </Section>
          )}
          <div className="pc-grid">
            {waiting.length > 0 && (
              <Section id="home-waiting" title="Waiting for you">
                <WaitingList items={waiting} />
              </Section>
            )}
            {/* Today over Quick actions beside Waiting; three across from 1280px. */}
            <div className="pc-grid-stack">
              {todayFacts.length > 0 && (
                <Section id="home-today" title={siteName ? `Today at ${siteName}` : "Today"}>
                  <TodayGrid items={todayFacts} />
                </Section>
              )}
              {actions.length > 0 ? (
                <Section id="home-actions" title="Quick actions">
                  <QuickActions items={actions} />
                  {meNote}
                </Section>
              ) : meNote}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
