import Link from "next/link";
import { CalendarPlus, ChevronRight, ClipboardCheck, FilePlus, ReceiptText, UserPlus, UserX, Waves, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { TimelineGrid, type TimelineBlock, type TimelineLane } from "@/components/workspace/timeline-grid";
import { formatTimeRange, plural } from "@/lib/format";
import { HOME_ITEM_META, HOME_SESSION_META } from "@/lib/home-meta";
import type { HomeIcon, HomeItem, HomeSession } from "@/modules/contributions";

/** The pieces the home page and every module overview share (DESIGN.md, "Poolside Clear v2"),
 *  so a figure, a queue, a quick action or the day's timeline looks the same wherever it
 *  appears. Each item carries the icon of the module it came from. */
export type Placed = HomeItem & { moduleIcon: LucideIcon; key: string };

/** Quick action and figure icons, by the name a module gives (modules import no UI). */
export const ACTION_ICONS: Record<HomeIcon, LucideIcon> = {
  userPlus: UserPlus, calendarPlus: CalendarPlus, receipt: ReceiptText, userX: UserX, filePlus: FilePlus, clipboardCheck: ClipboardCheck,
};

/** Split a module's items into the places they show. */
export function sortItems(items: Placed[]) {
  // What needs the person first, then anything waiting, then the empty queues.
  const rank = (i: HomeItem) => (i.attention ? 0 : i.count ? 1 : 2);
  return {
    actions: items.filter((i) => i.kind === "action"),
    today: items.filter((i) => i.kind === "today"),
    timeline: items.filter((i) => i.kind === "timeline" && i.sessions.length),
    waiting: items.filter((i) => !i.kind).sort((a, b) => rank(a) - rank(b)),
  };
}

/** A white panel with its title and, top right, one quiet action or summary. */
export function Section({ id, title, aside, children, wideOnly = false }: {
  id: string; title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode;
  /** Shown only from 1280px, e.g. a timeline whose narrow list would be empty. */
  wideOnly?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={wideOnly ? "pc-panel pc-timeline-wide" : "pc-panel"}>
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
    : <Tag meta={HOME_ITEM_META.clear} />;
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

/** Today's figures as tiles: an icon (the figure's own, else its module's), the figure, what
 *  it counts and one line more. A figure that needs the person puts its reason in the tag. */
export function TodayGrid({ items }: { items: Placed[] }) {
  return (
    <ul className="pc-stats">
      {items.map((item) => {
        const Icon = item.icon ? ACTION_ICONS[item.icon] : item.moduleIcon;
        return (
          <li key={item.key} className="flex">
            <Link href={item.href} className="pc-stat w-full">
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span><span className={`pc-stat-figure block${item.count ? "" : " text-ui-muted-foreground"}`}>{item.count}</span><span className="block font-semibold">{item.label}</span></span>
              {item.attention ? <Tag meta={HOME_ITEM_META.attention} label={item.hint ?? HOME_ITEM_META.attention.label} /> : item.hint ? <span className="text-xs text-ui-muted-foreground">{item.hint}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
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

/** The day at a glance on the shared TimelineGrid: one lane per pool area, hour tiles, every
 *  session a block with its state's tag, and a dashed line at the time now; below 1280px the
 *  list of what is on now and next. `now` is minutes after midnight. */
export function Timeline({ sessions, now }: { sessions: HomeSession[]; now: number }) {
  const first = Math.floor(Math.min(...sessions.map((s) => s.start)) / 60) * 60;
  const last = Math.ceil(Math.max(...sessions.map((s) => s.end)) / 60) * 60;
  // At most an hour's lead-in, so the time now shows when the first session is close.
  const from = Math.min(first, Math.max(Math.floor(now / 60) * 60, first - 60));
  const to = Math.max(last, from + 120);
  const areas = [...new Set(sessions.map((s) => s.area))].sort((a, b) => a.localeCompare(b));
  const lanes: TimelineLane[] = areas.map((area) => {
    const count = sessions.filter((s) => s.area === area).length;
    return { key: area, label: area, caption: plural(count, "session"), icon: Waves };
  });
  const blocks: TimelineBlock[] = sessions.map((s, i) => {
    const meta = HOME_SESSION_META[s.state];
    return {
      key: `${s.href}:${s.start}:${i}`, lane: s.area, start: s.start, end: s.end, state: s.state, href: s.href,
      title: s.label, hint: [s.hint, formatTimeRange(s.start, s.end)].filter(Boolean).join(" · "),
      agendaHint: [s.hint, s.area].filter(Boolean).join(" · "), tag: { icon: meta.icon, label: meta.label },
    };
  });
  // Two blocks in one area at once take a line each.
  const byArea = Map.groupBy(blocks, (b) => b.lane);
  for (const list of byArea.values()) {
    const ends: number[] = [];
    for (const b of [...list].sort((x, y) => x.start - y.start)) {
      const free = ends.findIndex((e) => e <= b.start);
      b.row = free >= 0 ? free : ends.length;
      ends[b.row] = b.end;
    }
  }
  return (
    <TimelineGrid from={from} to={to} now={now} lanes={lanes} blocks={blocks} laneHeading="Pool area" label="Classes today"
      agenda={{ show: (b) => b.state !== "done" && b.state !== "off", limit: 5, empty: "Nothing else on today." }} />
  );
}
