import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { NeedsSummary, PageList, Section, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";
import type { HomeItem } from "@/modules/contributions";

export type OverviewGroup = { label: string; links: { href: string; label: string; description?: string; icon: LucideIcon }[] };

/** A module's first page, the same shape in every module (DESIGN.md, "Poolside Clear v2"): its
 *  quick actions in the header (the main one last, in blue), today's figures and what waits for
 *  this person side by side, and every page it has with a line on what each is for. The items
 *  are the ones the module gives the home page (`registerHomeCard`), so the two always agree. */
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
  const buttons = actions.map((action, index) => (
    <Button key={action.key} asChild variant={index === actions.length - 1 ? "default" : "outline"}>
      <Link href={action.href}>{action.label}</Link>
    </Button>
  ));
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={name} description={description} actions={buttons.length ? buttons : undefined} />
      {(today.length > 0 || waiting.length > 0) && (
        <div className="grid min-w-0 items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
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
        <PageList groups={groups} />
      </Section>
    </div>
  );
}
