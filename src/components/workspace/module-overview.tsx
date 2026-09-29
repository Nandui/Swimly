import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { NeedsSummary, PageList, QuickActions, Section, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";
import type { HomeItem } from "@/modules/contributions";

export type OverviewGroup = { label: string; links: { href: string; label: string; description?: string; icon: LucideIcon }[] };

/** A module's first page, the same shape in every module: its quick actions,
 *  today's figures, what waits for this person, and every page it has with a
 *  line on what each is for. The items are the ones the module gives the
 *  home page (`registerHomeCard`), so the two always agree. */
export function ModuleOverview({ name, description, icon, siteName, items, groups }: {
  name: string;
  description: string;
  icon: LucideIcon;
  siteName: string | null;
  items: HomeItem[];
  groups: OverviewGroup[];
}) {
  const placed: Placed[] = items.map((item) => ({ ...item, moduleIcon: icon, key: `${item.href}:${item.label}` }));
  const { actions, today, waiting } = sortItems(placed);
  const needing = [...waiting, ...today].filter((i) => i.attention).length;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title={name} description={description} />
      <QuickActions items={actions} />
      {today.length > 0 && (
        <Section id="overview-today" title={siteName ? `Today at ${siteName}` : "Today"}>
          <TodayGrid items={today} wide />
        </Section>
      )}
      {waiting.length > 0 && (
        <Section id="overview-waiting" title="Waiting for you" aside={<NeedsSummary count={needing} />}>
          <WaitingList items={waiting} />
        </Section>
      )}
      <Section id="overview-pages" title={`Everything in ${name}`}>
        <PageList groups={groups} />
      </Section>
    </div>
  );
}
