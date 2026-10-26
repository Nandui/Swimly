import Link from "next/link";
import { ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { FiguresFailed } from "@/components/home/figures-failed";
import { HomeDay } from "@/components/home/home-day";
import { HomeNew } from "@/components/home/home-new";
import { greetingAt, homeLines } from "@/components/home/home-lines";
import { formatTime, plural } from "@/lib/format";
import type { ModuleManifest } from "@/modules/registry";
import type { HomeItem, HomeSession } from "@/modules/contributions";

/** Home (DESIGN.md, the approved canvas): what needs the person first, with the way to act on it,
 *  then what is happening now. The greeting and their job at their site; the site's day as lanes
 *  of classes, cover and bookings with the live time; "Needs you", every queue across their apps
 *  that waits for them, places to cover first; "Right now", today's figures; "Up next", what starts
 *  soon; and New, the things they start from anywhere. Their apps are in the sidebar (the tab bar's
 *  Apps on phones). Showing an item is presentation; every page checks its permission again. */
export function HomeView({ firstName, roleName, siteName, today, now, modules, items, failed = [], meUrl = null }: {
  firstName: string;
  roleName: string;
  siteName: string | null;
  today: string;
  /** Minutes after midnight at the centre when the page was made. */
  now: number;
  modules: readonly ModuleManifest[];
  /** Each app's items for this person (`registerHomeCard`). */
  items: ReadonlyMap<string, HomeItem[]>;
  /** Apps whose figures failed to load: a notice says so, as their lines are missing. */
  failed?: readonly string[];
  /** Turnfin Me's address when the staff API is set up; the note links there. */
  meUrl?: string | null;
}) {
  const { sessions, timelineHref, toCover, queues, figures, actions, upNext } = homeLines(modules, items, now);
  const missing = modules.filter((mod) => failed.includes(mod.id)).map((mod) => mod.name);
  const greeting = greetingAt(now);
  const where = siteName ? `${roleName} at ${siteName}` : roleName;
  const needCount = toCover.length + queues.length;
  const side = figures.length > 0 || upNext.length > 0;

  return (
    <PageShell spacing="roomy" header={<PageHeader title={`${greeting}, ${firstName}`} description={`${today} · ${where}`} actions={actions.length ? <HomeNew actions={actions} /> : undefined} />}>
      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no apps yet. Ask an admin to give it a level in the apps you need." />
      ) : (
        <>
          {missing.length > 0 ? <FiguresFailed modules={missing} /> : null}
          {sessions.length && timelineHref ? <HomeDay siteName={siteName} sessions={sessions} initialNow={now} href={timelineHref} /> : null}
          <div className={side ? "grid min-w-0 items-start gap-(--space-7) lg:grid-cols-2" : "flex min-w-0 flex-col"}>
            <section aria-labelledby="home-needs" className="flex min-w-0 flex-col">
              <div className="pc-section-head">
                <h2 id="home-needs">Needs you</h2>
                {needCount ? <p>{needCount}</p> : null}
              </div>
              <ul className="pc-list">
                {toCover.map((session) => <CoverRow key={`${session.href}:${session.start}`} session={session} now={now} />)}
                {queues.map(({ item, module, key }) => (
                  <li key={key}>
                    <Link href={item.href} className="pc-row">
                      <span className="pc-tile-icon"><module.icon aria-hidden="true" /></span>
                      <span className="pc-row-body"><span>{item.label}</span><span className="pc-row-hint">{[module.name, item.hint].filter(Boolean).join(" · ")}</span></span>
                      <span className="pc-row-value">{item.count}</span>
                      <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                    </Link>
                  </li>
                ))}
                {needCount === 0 ? (
                  <li>
                    <div className="pc-row">
                      <span className="pc-tile-icon" data-tone="green"><CircleCheck aria-hidden="true" /></span>
                      <span className="pc-row-body"><span>Nothing needs you right now</span><span className="pc-row-hint">Requests, places to cover and checks that wait for you show here.</span></span>
                    </div>
                  </li>
                ) : null}
              </ul>
            </section>
            {side ? (
              <div className="flex min-w-0 flex-col gap-(--space-7)">
                {figures.length ? (
                  <section aria-labelledby="home-now" className="flex min-w-0 flex-col">
                    <div className="pc-section-head"><h2 id="home-now">Right now</h2></div>
                    <ul className="pc-stats">
                      {figures.map(({ item, key }) => (
                        <li key={key} className="flex">
                          <Link href={item.href} className="pc-stat w-full">
                            <span className="pc-stat-figure">{item.count}</span>
                            <span className="text-(--label-2)">{item.label}</span>
                            {item.hint ? <span className={`text-footnote ${item.attention ? "text-(--orange-ink)" : "text-(--label-2)"}`}>{item.hint}</span> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {upNext.length ? (
                  <section aria-labelledby="home-next" className="flex min-w-0 flex-col">
                    <div className="pc-section-head"><h2 id="home-next">Up next</h2></div>
                    <ul className="pc-list">
                      {upNext.map((session) => (
                        <li key={`${session.href}:${session.start}`}>
                          <Link href={session.href} className="pc-row">
                            <span className="w-12 shrink-0 font-semibold tabular-nums">{formatTime(session.start)}</span>
                            <span className="pc-row-body"><span>{session.label}</span></span>
                            <span className="pc-row-value">{session.area}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-footnote text-(--label-2)">
            Your own training, reading, shifts and HR are in {meUrl ? <a href={meUrl} target="_blank" rel="noopener noreferrer" className="text-(--accent)">Turnfin Me<span className="sr-only"> (opens in a new tab)</span></a> : "Turnfin Me"}, on your phone.
          </p>
        </>
      )}
    </PageShell>
  );
}

/** A place still to cover, first in "Needs you": the class and time, how soon it starts, and the
 *  way to find cover, on the class. */
function CoverRow({ session, now }: { session: HomeSession; now: number }) {
  const until = session.start - now;
  const when = until > 0 ? `starts in ${until < 60 ? plural(until, "minute") : `${Math.round(until / 60)} h`}` : `started at ${formatTime(session.start)}`;
  return (
    <li>
      <div className="pc-row">
        <span className="pc-tile-icon" data-tone="orange"><TriangleAlert aria-hidden="true" /></span>
        <span className="pc-row-body">
          <span className="font-semibold">{session.label}, {formatTime(session.start)}</span>
          <span className="pc-row-hint" data-tone="orange">Not covered · {when}</span>
        </span>
        <Button asChild variant="outline"><Link href={session.href}>Find cover</Link></Button>
      </div>
    </li>
  );
}
