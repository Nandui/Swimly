import Link from "next/link";
import { ArrowRight, CalendarPlus, ChevronRight, CircleCheck, ClipboardCheck, FilePlus, ReceiptText, Search, Smartphone, TriangleAlert, UserPlus, UserX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { HOME_ITEM_META } from "@/lib/home-meta";
import type { ModuleManifest } from "@/modules/registry";
import type { HomeIcon, HomeItem } from "@/modules/contributions";

const ACTION_ICONS: Record<HomeIcon, LucideIcon> = {
  search: Search, userPlus: UserPlus, calendarPlus: CalendarPlus, receipt: ReceiptText, userX: UserX, filePlus: FilePlus, clipboardCheck: ClipboardCheck,
};

type Placed = HomeItem & { mod: ModuleManifest };

/** A role's home page, in the order the day needs it: quick actions, what is
 *  happening today, what waits for this person, then each module's links and
 *  a pointer to Turnfin Me. Modules supply everything (`registerHomeCard`);
 *  an item's kind decides where it goes. */
export function HomeView({ homeName, roleName, siteName, today, modules, items }: {
  homeName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  modules: readonly ModuleManifest[];
  items: ReadonlyMap<string, HomeItem[]>;
}) {
  const placed: Placed[] = modules.flatMap((mod) => (items.get(mod.id) ?? []).map((item) => ({ ...item, mod })));
  const actions = placed.filter((i) => i.kind === "action");
  const todayFacts = placed.filter((i) => i.kind === "today");
  // What needs the person first, then anything waiting, then the empty queues.
  const rank = (i: HomeItem) => (i.attention ? 0 : i.count ? 1 : 2);
  const waiting = placed.filter((i) => !i.kind && i.count !== undefined).sort((a, b) => rank(a) - rank(b));
  const needing = waiting.filter((i) => i.attention).length + todayFacts.filter((i) => i.attention).length;
  const links = (mod: ModuleManifest) => placed.filter((i) => i.mod === mod && !i.kind && i.count === undefined);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ui-muted-foreground">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{homeName}</h1>
        <p className="text-sm text-ui-muted-foreground">{[roleName, siteName].filter(Boolean).join(" · ")}</p>
      </header>

      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no modules yet. Ask an admin to give it a level in the modules you need." />
      ) : (
        <>
          {actions.length > 0 && (
            <section aria-labelledby="home-actions" className="flex flex-col gap-3">
              <h2 id="home-actions" className="sr-only">Quick actions</h2>
              <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {actions.map((action) => {
                  const Icon = action.icon ? ACTION_ICONS[action.icon] : action.mod.icon;
                  return (
                    <li key={`${action.mod.id}:${action.label}`}>
                      <Button asChild variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal bg-ui-card py-2 text-left sm:w-auto">
                        <Link href={action.href}><Icon aria-hidden="true" className="text-ui-primary" />{action.label}</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {todayFacts.length > 0 && (
            <section aria-labelledby="home-today" className="flex flex-col gap-3">
              <h2 id="home-today" className="text-lg font-semibold">{siteName ? `Today at ${siteName}` : "Today"}</h2>
              <ul className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
                {todayFacts.map((fact) => <li key={`${fact.mod.id}:${fact.label}`} className={fact.list?.length ? "col-span-2" : undefined}><FigureTile item={fact} /></li>)}
              </ul>
            </section>
          )}

          {waiting.length > 0 && (
            <section aria-labelledby="home-waiting" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="home-waiting" className="text-lg font-semibold">Waiting for you</h2>
                <p className="flex items-center gap-1.5 text-sm text-ui-muted-foreground">
                  {needing ? `${needing} ${needing === 1 ? "thing needs" : "things need"} you` : <><CircleCheck aria-hidden="true" className="size-4 text-ui-primary" />All clear</>}
                </p>
              </div>
              <ul className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
                {waiting.map((item) => <li key={`${item.mod.id}:${item.label}`}><FigureTile item={item} /></li>)}
              </ul>
            </section>
          )}

          <section aria-labelledby="home-modules" className="flex flex-col gap-3">
            <h2 id="home-modules" className="text-lg font-semibold">Your modules</h2>
            <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((mod) => <ModuleCard key={mod.id} mod={mod} links={links(mod)} />)}
            </div>
          </section>
        </>
      )}

      <Card className="flex-row items-start gap-3 bg-ui-muted p-5 shadow-none">
        <Smartphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-primary" />
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Your own things are in Turnfin Me</h2>
          <p className="text-sm text-ui-muted-foreground">Your training, required reading, qualifications, shifts and anything HR shares with you. Open Turnfin Me on your phone.</p>
        </div>
      </Card>
    </div>
  );
}

/** A figure with its label, the whole tile one link: today's facts and the
 *  queues that wait for this person. */
function FigureTile({ item }: { item: Placed }) {
  const Icon = item.mod.icon;
  return (
    <Card className="relative h-full min-w-0 gap-2 p-4 shadow-none transition-colors hover:bg-ui-accent has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-ui-ring">
      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ui-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-ui-primary" />
        <Link href={item.href} className="min-w-0 flex-1 outline-none after:absolute after:inset-0 after:rounded-[inherit]">{item.label}</Link>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[length:var(--pc-text-figure)] leading-[var(--pc-leading-figure)] font-bold tabular-nums tracking-tight${item.count ? "" : " text-ui-muted-foreground"}`}>{item.count}</span>
        {item.attention ? <Tag color={HOME_ITEM_META.attention.color}><TriangleAlert aria-hidden="true" className="size-3" />{HOME_ITEM_META.attention.label}</Tag> : null}
      </div>
      {item.hint ? <p className="text-sm text-ui-muted-foreground">{item.hint}</p> : null}
      {item.list?.length ? (
        <ul className="mt-1 flex flex-col divide-y divide-ui-border border-t border-ui-border">
          {item.list.map((line) => (
            <li key={`${line.label}:${line.hint}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
              <span className="min-w-0 font-medium">{line.label}</span>
              {line.hint ? <span className="text-ui-muted-foreground tabular-nums">{line.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

/** A module's own links, for everything that is not a figure or an action. */
function ModuleCard({ mod, links }: { mod: ModuleManifest; links: Placed[] }) {
  const Icon = mod.icon;
  const titleId = `home-${mod.id}`;
  return (
    <Card className="min-w-0 gap-2 p-4 shadow-none" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-ui-primary" />
          {mod.name}
        </h3>
        <Button asChild variant="ghost" className="min-h-11 shrink-0">
          <Link href={mod.href} aria-label={`Open ${mod.name}`}>Open<ArrowRight aria-hidden="true" /></Link>
        </Button>
      </div>
      {links.length > 0 ? (
        <ul className="-mx-2 flex flex-col">
          {links.map((item) => (
            <li key={`${item.href}:${item.label}`}>
              <Link href={item.href} className="flex min-h-11 items-center gap-3 rounded-ui-md px-2 py-2 hover:bg-ui-accent focus-visible:outline-2 focus-visible:outline-ui-ring">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.hint ? <span className="mt-0.5 block text-xs text-ui-muted-foreground">{item.hint}</span> : null}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ui-muted-foreground">{mod.description}</p>
      )}
    </Card>
  );
}
