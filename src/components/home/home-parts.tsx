import Link from "next/link";
import { CalendarPlus, ChevronRight, CircleCheck, ClipboardCheck, FilePlus, ReceiptText, Search, UserPlus, UserX, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { HOME_ITEM_META, HOME_SESSION_META } from "@/lib/home-meta";
import type { HomeIcon, HomeItem, HomeSession } from "@/modules/contributions";

/** The pieces the home page and every module overview share (DESIGN.md, "Poolside Clear v2"),
 *  so a figure, a queue, a quick action or the day's timeline looks the same wherever it
 *  appears. Each item carries the icon of the module it came from. */
export type Placed = HomeItem & { moduleIcon: LucideIcon; key: string };

const ACTION_ICONS: Record<HomeIcon, LucideIcon> = {
  search: Search, userPlus: UserPlus, calendarPlus: CalendarPlus, receipt: ReceiptText, userX: UserX, filePlus: FilePlus, clipboardCheck: ClipboardCheck,
};

/** Split a module's items into the places they show. */
export function sortItems(items: Placed[]) {
  // What needs the person first, then anything waiting, then the empty queues.
  const rank = (i: HomeItem) => (i.attention ? 0 : i.count ? 1 : 2);
  return {
    actions: items.filter((i) => i.kind === "action"),
    today: items.filter((i) => i.kind === "today"),
    timeline: items.filter((i) => i.kind === "timeline" && i.sessions?.length),
    waiting: items.filter((i) => !i.kind && i.count !== undefined).sort((a, b) => rank(a) - rank(b)),
    links: items.filter((i) => !i.kind && i.count === undefined),
  };
}

/** A white panel with its title and, top right, one quiet action or summary. */
export function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="pc-panel">
      <div className="pc-panel-head">
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function NeedsYou() {
  return <Tag meta={HOME_ITEM_META.attention} />;
}

/** "3 things need you", or "All clear". */
export function NeedsSummary({ count }: { count: number }) {
  return count
    ? <Tag meta={HOME_ITEM_META.attention} label={`${count} ${count === 1 ? "thing needs" : "things need"} you`} />
    : <p className="flex items-center gap-1.5 text-sm text-ui-muted-foreground"><CircleCheck aria-hidden="true" className="size-4 text-ui-primary" />All clear</p>;
}

/** Quick actions as rows: an icon, what it does, and the way in. */
export function QuickActions({ items }: { items: Placed[] }) {
  if (!items.length) return null;
  return (
    <ul className="pc-rows" aria-label="Quick actions">
      {items.map((action) => {
        const Icon = action.icon ? ACTION_ICONS[action.icon] : action.moduleIcon;
        return (
          <li key={action.key}>
            <Link href={action.href} className="pc-row">
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span className="pc-row-body"><span className="pc-row-title">{action.label}</span></span>
              <span className="pc-row-trail"><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Today's figures as tiles: the module's icon, the figure, what it counts and one line more.
 *  A figure with a list (an instructor's next classes) lists them under the tiles. */
export function TodayGrid({ items }: { items: Placed[]; wide?: boolean }) {
  const lists = items.filter((i) => i.list?.length);
  return (
    <>
      <ul className="pc-stats">
        {items.map((item) => {
          const Icon = item.moduleIcon;
          return (
            <li key={item.key} className="flex">
              <Link href={item.href} className="pc-stat w-full">
                <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
                <span><span className={`pc-stat-figure block${item.count ? "" : " text-ui-muted-foreground"}`}>{item.count}</span><span className="block font-semibold">{item.label}</span></span>
                {item.attention ? <NeedsYou /> : item.hint ? <span className="text-xs text-ui-muted-foreground">{item.hint}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {lists.map((item) => (
        <ul key={`${item.key}:list`} className="pc-rows" aria-label={item.label}>
          {item.list!.map((line) => (
            <li key={`${line.label}:${line.hint}`} className="pc-row" style={{ minHeight: 56 }}>
              <span className="pc-row-body"><span className="pc-row-title">{line.label}</span>{line.hint ? <span className="pc-row-hint tabular-nums">{line.hint}</span> : null}</span>
            </li>
          ))}
        </ul>
      ))}
    </>
  );
}

/** Queues as rows: what it is and how many wait. The first one that needs this person is the
 *  page's single do-first item. */
export function WaitingList({ items }: { items: Placed[] }) {
  const first = items.findIndex((i) => i.attention);
  return (
    <ul className="pc-rows">
      {items.map((item, index) => (
        <li key={item.key}>
          <Link href={item.href} className="pc-row" data-first={index === first ? "" : undefined} data-muted={!item.count ? "" : undefined}>
            <span className="pc-row-body"><span className="pc-row-title">{item.label}</span>{item.hint ? <span className="pc-row-hint">{item.hint}</span> : null}</span>
            <span className="pc-row-trail">
              {item.attention && index !== first ? <NeedsYou /> : null}
              {item.attention && index === first ? <span className="sr-only">{HOME_ITEM_META.attention.label}</span> : null}
              <span className="pc-row-count">{item.count}</span>
              <ChevronRight aria-hidden="true" className="pc-row-chevron" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A module's pages as grouped rows, two or three across when wide. */
export function PageList({ groups }: { groups: { label: string; links: { href: string; label: string; description?: string; icon: LucideIcon }[] }[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.filter((g) => g.links.length).map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          {group.label ? <h3 className="text-xs font-semibold text-ui-muted-foreground">{group.label}</h3> : null}
          <ul className="pc-rows pc-rows-grid">
            {group.links.map((link) => (
              <li key={link.href} className="flex">
                <Link href={link.href} className="pc-row w-full">
                  <span className="pc-tile-icon"><link.icon aria-hidden="true" /></span>
                  <span className="pc-row-body"><span className="pc-row-title">{link.label}</span>{link.description ? <span className="pc-row-hint">{link.description}</span> : null}</span>
                  <span className="pc-row-trail"><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function SessionTag({ state, iconOnly }: { state: HomeSession["state"]; iconOnly?: boolean }) {
  const { icon: Icon, label } = HOME_SESSION_META[state];
  return <span className="pc-block-tag"><Icon aria-hidden="true" />{iconOnly ? <span className="sr-only">{label}</span> : label}</span>;
}

/** The day at a glance: one lane per area, half-hour columns, a dashed line at the time now.
 *  On a phone it becomes the list of what is on now and next. `now` is minutes after midnight. */
export function Timeline({ sessions, now }: { sessions: HomeSession[]; now: number }) {
  const from = Math.floor(Math.min(...sessions.map((s) => s.start)) / 60) * 60;
  // At least four hours, so a quiet day still reads as a day.
  const to = Math.max(Math.ceil(Math.max(...sessions.map((s) => s.end)) / 60) * 60, from + 240);
  const columns = Math.max(2, (to - from) / 30);
  const lanes = [...new Set(sessions.map((s) => s.area))].sort((a, b) => a.localeCompare(b));
  const hours = Array.from({ length: columns / 2 }, (_, i) => from + i * 60);
  const col = (minutes: number) => Math.floor((minutes - from) / 30) + 2;
  const upcoming = sessions.filter((s) => s.state !== "done" && s.state !== "off").sort((a, b) => a.start - b.start).slice(0, 5);
  const states = [...new Set(sessions.map((s) => s.state))];
  return (
    <>
      <div className="pc-timeline-scroll pc-only-wide">
        <div className="pc-timeline" style={{ gridTemplateColumns: `200px repeat(${columns}, minmax(56px, 1fr))`, gridTemplateRows: `44px repeat(${lanes.length}, 56px)`, minWidth: 200 + columns * 64 }}>
          <span className="self-center text-xs font-semibold text-ui-muted-foreground" style={{ gridColumn: 1, gridRow: 1 }}>Area</span>
          {hours.map((hour) => (
            <span key={hour} className="pc-timeline-hour" style={{ gridColumn: `${col(hour)} / span 2`, gridRow: 1 }}
              data-past={hour + 60 <= now ? "" : undefined} data-now={hour <= now && now < hour + 60 ? "" : undefined}>
              {clock(hour)}{hour <= now && now < hour + 60 ? <span className="sr-only">, now {clock(now)}</span> : null}
            </span>
          ))}
          {lanes.map((lane, index) => {
            const count = sessions.filter((s) => s.area === lane).length;
            return (
              <span key={lane} className="pc-timeline-lane" style={{ gridColumn: 1, gridRow: index + 2 }}>
                <span className="font-semibold">{lane}</span><span className="text-xs text-ui-muted-foreground">{count} {count === 1 ? "session" : "sessions"}</span>
              </span>
            );
          })}
          {sessions.map((s) => (
            <Link key={`${s.href}:${s.start}`} href={s.href} className="pc-block" data-state={s.state}
              style={{ gridColumn: `${col(s.start)} / span ${Math.max(1, Math.round((s.end - s.start) / 30))}`, gridRow: lanes.indexOf(s.area) + 2 }}>
              <span className="pc-block-body"><span className="pc-block-title">{s.label}</span><span className="pc-block-hint tabular-nums">{s.hint ? `${s.hint} · ` : ""}{clock(s.start)} to {clock(s.end)}</span></span>
              {s.state !== "next" ? <SessionTag state={s.state} iconOnly /> : null}
            </Link>
          ))}
          {now >= from && now < to ? (
            <span aria-hidden="true" className="pc-timeline-now" style={{ gridColumn: col(now), gridRow: `2 / ${lanes.length + 2}`, ["--at" as string]: `${(((now - from) % 30) / 30) * 100}%` }} />
          ) : null}
        </div>
      </div>
      <ul className="pc-only-wide flex flex-wrap gap-2" aria-label="Key">
        {states.map((state) => <li key={state}><Tag meta={HOME_SESSION_META[state]} /></li>)}
      </ul>
      <ul className="pc-only-narrow flex-col gap-2" aria-label="On now and next">
        {upcoming.length ? upcoming.map((s) => (
          <li key={`${s.href}:${s.start}:n`}>
            <Link href={s.href} className="pc-block" data-state={s.state}>
              <span className="pc-block-time">{clock(s.start)}<small>to {clock(s.end)}</small></span>
              <span className="pc-block-body"><span className="pc-block-title">{s.label}</span><span className="pc-block-hint">{s.hint ? `${s.hint} · ` : ""}{s.area}</span></span>
              <SessionTag state={s.state} />
            </Link>
          </li>
        )) : <li className="text-sm text-ui-muted-foreground">Nothing else on today.</li>}
      </ul>
    </>
  );
}
