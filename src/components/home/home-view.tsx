import Link from "next/link";
import { ChevronRight, Smartphone } from "lucide-react";
import { Card } from "@/components/shadcn/card";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { HOME_ITEM_META } from "@/lib/home-meta";
import type { ModuleManifest } from "@/modules/registry";
import type { HomeItem } from "@/modules/contributions";
import { NeedsSummary, QuickActions, Section, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";

/** A role's home page. The day's work on the left: quick actions, today's
 *  figures, and what waits for this person. The person's modules and Turnfin
 *  Me on the right (below on a phone). Modules supply every item
 *  (`registerHomeCard`); each module's own overview carries the rest. */
export function HomeView({ homeName, roleName, siteName, today, modules, items }: {
  homeName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  modules: readonly ModuleManifest[];
  items: ReadonlyMap<string, HomeItem[]>;
}) {
  const placed: Placed[] = modules.flatMap((mod) => (items.get(mod.id) ?? []).map((item) => ({ ...item, moduleIcon: mod.icon, key: `${mod.id}:${item.label}` })));
  const { actions, today: todayFacts, waiting } = sortItems(placed);
  const needing = [...waiting, ...todayFacts].filter((i) => i.attention).length;
  const needsIn = (mod: ModuleManifest) => (items.get(mod.id) ?? []).filter((i) => i.attention).length;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{homeName}</h1>
        <p className="text-sm text-ui-muted-foreground">{[today, roleName, siteName].filter(Boolean).join(" · ")}</p>
      </header>

      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no modules yet. Ask an admin to give it a level in the modules you need." />
      ) : (
        <>
          <QuickActions items={actions} />
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-6">
              {todayFacts.length > 0 && (
                <Section id="home-today" title={siteName ? `Today at ${siteName}` : "Today"}>
                  <TodayGrid items={todayFacts} />
                </Section>
              )}
              {waiting.length > 0 && (
                <Section id="home-waiting" title="Waiting for you" aside={<NeedsSummary count={needing} />}>
                  <WaitingList items={waiting} />
                </Section>
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-6" aria-label="Your modules and Turnfin Me">
              <Section id="home-modules" title="Your modules">
                <Card className="gap-0 overflow-hidden p-0 shadow-none">
                  <ul className="flex flex-col divide-y divide-ui-border">
                    {modules.map((mod) => {
                      const needs = needsIn(mod);
                      return (
                        <li key={mod.id}>
                          <Link href={mod.href} className="flex min-h-11 items-center gap-3 px-4 py-2.5 hover:bg-ui-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-ring">
                            <mod.icon aria-hidden="true" className="size-4 shrink-0 text-ui-primary" />
                            <span className="min-w-0 flex-1 text-sm font-medium">{mod.name}</span>
                            {needs ? <Tag color={HOME_ITEM_META.attention.color}>{needs}<span className="sr-only"> {needs === 1 ? "thing needs" : "things need"} you</span></Tag> : null}
                            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </Section>
              <div className="flex items-start gap-3 rounded-ui-lg bg-ui-muted p-4">
                <Smartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ui-primary" />
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">Your own things are in Turnfin Me</h2>
                  <p className="text-xs text-ui-muted-foreground">Your training, required reading, qualifications, shifts and anything HR shares with you, on your phone.</p>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
