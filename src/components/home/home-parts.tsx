import Link from "next/link";
import { CalendarPlus, ChevronRight, CircleCheck, ClipboardCheck, FilePlus, ReceiptText, Search, TriangleAlert, UserPlus, UserX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Tag } from "@/components/ui-kit/tag";
import { HOME_ITEM_META } from "@/lib/home-meta";
import type { HomeIcon, HomeItem } from "@/modules/contributions";

/** The pieces the home page and every module overview share, so a figure, a
 *  queue or a quick action looks the same wherever it appears. Each item
 *  carries the icon of the module it came from. */
export type Placed = HomeItem & { moduleIcon: LucideIcon; key: string };

const ACTION_ICONS: Record<HomeIcon, LucideIcon> = {
  search: Search, userPlus: UserPlus, calendarPlus: CalendarPlus, receipt: ReceiptText, userX: UserX, filePlus: FilePlus, clipboardCheck: ClipboardCheck,
};

/** Split a module's items into the three places they show. */
export function sortItems(items: Placed[]) {
  // What needs the person first, then anything waiting, then the empty queues.
  const rank = (i: HomeItem) => (i.attention ? 0 : i.count ? 1 : 2);
  return {
    actions: items.filter((i) => i.kind === "action"),
    today: items.filter((i) => i.kind === "today"),
    waiting: items.filter((i) => !i.kind && i.count !== undefined).sort((a, b) => rank(a) - rank(b)),
    links: items.filter((i) => !i.kind && i.count === undefined),
  };
}

export function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function QuickActions({ items }: { items: Placed[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Quick actions">
      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {items.map((action) => {
          const Icon = action.icon ? ACTION_ICONS[action.icon] : action.moduleIcon;
          return (
            <li key={action.key}>
              <Button asChild variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal bg-ui-card py-2 text-left sm:w-auto">
                <Link href={action.href}><Icon aria-hidden="true" className="text-ui-primary" />{action.label}</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Today's figures in rows without gaps: side by side when there are two or
 *  three, two by two when there are four (four in a row once the page is
 *  wide enough). A figure with a list, an instructor's next classes, takes
 *  a full row. */
export function TodayGrid({ items, wide = false }: { items: Placed[]; wide?: boolean }) {
  const plain = items.filter((i) => !i.list?.length).length;
  const columns = plain === 3 ? "sm:grid-cols-3" : plain >= 4 ? `sm:grid-cols-2 ${wide ? "lg:grid-cols-4" : "2xl:grid-cols-4"}` : plain === 2 ? "sm:grid-cols-2" : "";
  return (
    <ul className={`grid min-w-0 grid-cols-2 gap-3 ${columns} [&>li:last-child:nth-child(odd)]:col-span-full ${plain === 3 || plain === 1 ? "sm:[&>li:last-child:nth-child(odd)]:col-span-1" : ""}`}>
      {items.map((item) => <li key={item.key} className={item.list?.length ? "col-span-full" : undefined}><FigureTile item={item} /></li>)}
    </ul>
  );
}

/** A figure with its label, the whole tile one link. */
function FigureTile({ item }: { item: Placed }) {
  const Icon = item.moduleIcon;
  return (
    <Card className="relative h-full min-w-0 gap-1.5 p-4 shadow-none transition-colors hover:bg-ui-accent has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-ui-ring">
      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ui-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-ui-primary" />
        <Link href={item.href} className="min-w-0 flex-1 outline-none after:absolute after:inset-0 after:rounded-[inherit]">{item.label}</Link>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-3xl font-bold tabular-nums tracking-tight${item.count ? "" : " text-ui-muted-foreground"}`}>{item.count}</span>
        {item.attention ? <NeedsYou /> : null}
      </div>
      {item.hint ? <p className="text-xs text-ui-muted-foreground">{item.hint}</p> : null}
      {item.list?.length ? (
        <ul className="mt-1 flex flex-col divide-y divide-ui-border border-t border-ui-border">
          {item.list.map((line) => (
            <li key={`${line.label}:${line.hint}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
              <span className="min-w-0 font-medium">{line.label}</span>
              {line.hint ? <span className="text-xs text-ui-muted-foreground tabular-nums">{line.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function NeedsYou() {
  return <Tag color={HOME_ITEM_META.attention.color}><TriangleAlert aria-hidden="true" className="size-3" />{HOME_ITEM_META.attention.label}</Tag>;
}

/** "3 things need you", or "All clear". */
export function NeedsSummary({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-ui-muted-foreground">
      {count ? `${count} ${count === 1 ? "thing needs" : "things need"} you` : <><CircleCheck aria-hidden="true" className="size-4 text-ui-primary" />All clear</>}
    </p>
  );
}

/** Queues as one panel of rows: what it is, and how many wait. */
export function WaitingList({ items }: { items: Placed[] }) {
  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-none">
      <ul className="flex flex-col divide-y divide-ui-border">
        {items.map((item) => {
          const Icon = item.moduleIcon;
          return (
            <li key={item.key}>
              <Link href={item.href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-ui-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-ring">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-ui-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.hint ? <span className="block text-xs text-ui-muted-foreground">{item.hint}</span> : null}
                </span>
                {item.attention ? <NeedsYou /> : null}
                <span className={`min-w-8 text-right text-base font-semibold tabular-nums${item.count ? "" : " text-ui-muted-foreground"}`}>{item.count}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** A module's pages as one panel of grouped rows, two columns when wide. */
export function PageList({ groups }: { groups: { label: string; links: { href: string; label: string; description?: string; icon: LucideIcon }[] }[] }) {
  return (
    <Card className="gap-0 p-2 shadow-none">
      {groups.filter((g) => g.links.length).map((group) => (
        <div key={group.label} className="flex flex-col">
          {group.label ? <p className="px-3 pb-1 pt-3 text-xs font-semibold text-ui-muted-foreground">{group.label}</p> : null}
          <ul className="grid gap-x-2 lg:grid-cols-2">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex min-h-11 items-start gap-3 rounded-ui-md px-3 py-2.5 hover:bg-ui-accent focus-visible:outline-2 focus-visible:outline-ui-ring">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-ui-md bg-ui-accent text-ui-primary"><link.icon aria-hidden="true" className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{link.label}</span>
                    {link.description ? <span className="block text-xs text-ui-muted-foreground">{link.description}</span> : null}
                  </span>
                  <ChevronRight aria-hidden="true" className="mt-2 size-4 shrink-0 text-ui-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
