import type { HomeItem, HomeSession } from "@/modules/contributions";

/** What Home shows, from every app's items (`registerHomeCard`), in the person's apps' order:
 *  - `toCover`: places still to cover today, soonest first, at the top of "Needs you";
 *  - `queues`: every queue that waits for this person (items without a kind that need them);
 *  - `figures`: today's figures for "Right now";
 *  - `actions`: the things they start from anywhere, for New;
 *  - `sessions` and `timelineHref`: the day's lanes and where the timetable is;
 *  - `upNext`: the next four sessions that have not started, cancelled ones left out.
 *  `now` is minutes after midnight at the centre. */
export function homeLines<M extends { id: string }>(modules: readonly M[], items: ReadonlyMap<string, HomeItem[]>, now: number) {
  const placed = modules.flatMap((module) => (items.get(module.id) ?? []).map((item, index) => ({ item, module, key: `${module.id}:${index}` })));
  const sessions: HomeSession[] = placed.flatMap(({ item }) => (item.kind === "timeline" ? item.sessions : []));
  return {
    sessions,
    timelineHref: placed.find(({ item }) => item.kind === "timeline")?.item.href ?? null,
    toCover: sessions.filter((s) => s.state === "cover" && s.end > now).sort((a, b) => a.start - b.start),
    queues: placed.filter(({ item }) => !item.kind && item.attention),
    figures: placed.filter(({ item }) => item.kind === "today"),
    actions: placed.filter(({ item }) => item.kind === "action").map(({ item, key }) => ({ key, label: item.label, href: item.href, icon: item.icon })),
    upNext: sessions.filter((s) => s.start >= now && s.state !== "off").sort((a, b) => a.start - b.start).slice(0, 4),
  };
}

/** The greeting for the time at the centre. */
export function greetingAt(now: number) {
  const hour = Math.floor(now / 60);
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
