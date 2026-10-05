import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ACTION_ICONS, NeedsSummary, PageList, Section, TodayGrid, WaitingList, sortItems, type Placed } from "@/components/home/home-parts";
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
  const pages = groups.filter((group) => group.links.length > 0);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={name} description={description} actions={buttons.length ? buttons : undefined} />
      {(today.length > 0 || waiting.length > 0) && (
        <div className="pc-grid">
          {today.length > 0 && (
            <Section id="overview-today" title={siteName ? `Today at ${siteName}` : "Today"}
              aside={schedule ? <Button asChild variant="ghost"><Link href={schedule.href}>Open schedule<ChevronRight aria-hidden="true" /></Link></Button> : undefined}>
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
    </div>
  );
}
