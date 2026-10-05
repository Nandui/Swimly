import Link from "next/link";
import { ChevronRight, Smartphone } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { minutesNow } from "@/lib/format";
import type { ModuleManifest } from "@/modules/registry";
import type { HomeItem } from "@/modules/contributions";
import { NeedsSummary, QuickActions, Section, Timeline, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";

/** A role's home page (DESIGN.md, "Poolside Clear v2"): the day at a glance on a timeline, then
 *  what waits for this person, today's figures and the quick actions, with the note that their
 *  own things are in Turnfin Me. Modules supply every item (`registerHomeCard`); each module's
 *  own overview carries the rest, and the module bar is the way into each module. */
export function HomeView({ homeName, roleName, siteName, today, modules, items }: {
  homeName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  modules: readonly ModuleManifest[];
  items: ReadonlyMap<string, HomeItem[]>;
}) {
  const placed: Placed[] = modules.flatMap((mod) => (items.get(mod.id) ?? []).map((item) => ({ ...item, moduleIcon: mod.icon, key: `${mod.id}:${item.label}` })));
  const { actions, today: todayFacts, timeline, waiting } = sortItems(placed);
  const needing = [...waiting, ...todayFacts].filter((i) => i.attention).length;
  const sessions = timeline.flatMap((t) => t.sessions ?? []);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={homeName} description={[today, roleName, siteName].filter(Boolean).join(" · ")} actions={modules.length ? <NeedsSummary count={needing} /> : undefined} />

      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no modules yet. Ask an admin to give it a level in the modules you need." />
      ) : (
        <>
          {sessions.length > 0 && (
            <Section id="home-timeline" title={timeline[0].label}
              aside={<Button asChild variant="ghost"><Link href={timeline[0].href}>Open schedule<ChevronRight aria-hidden="true" /></Link></Button>}>
              <Timeline sessions={sessions} now={minutesNow()} />
            </Section>
          )}
          <div className="pc-grid">
            {waiting.length > 0 && (
              <Section id="home-waiting" title="Waiting for you">
                <WaitingList items={waiting} />
              </Section>
            )}
            {todayFacts.length > 0 && (
              <Section id="home-today" title={siteName ? `Today at ${siteName}` : "Today"}>
                <TodayGrid items={todayFacts} />
              </Section>
            )}
            <Section id="home-actions" title="Quick actions">
              <QuickActions items={actions} />
              <div className="pc-note">
                <Smartphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Your own things are in Turnfin Me</span>
                  <span className="text-xs text-ui-muted-foreground">Your training, required reading, qualifications, shifts and anything HR shares with you, on your phone.</span>
                </div>
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
