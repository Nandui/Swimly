/** What every page shows for the moment between a click and its data.
 *
 *  Without this, nothing paints until the slowest query on the destination
 *  page has answered — the shell, the title, all of it waits. This file makes
 *  Next wrap each page in a Suspense boundary, so the sidebar and this
 *  placeholder arrive at once and the real page streams in behind them. It is
 *  the cheapest "feels faster" the app can have, because it costs no query.
 *
 *  Shaped like every page: a title, a description line, a sentence, a table.
 *  No spinner — a spinner says "wait", a page-shaped placeholder says "here it
 *  comes". Muted fills only; blue is for things you can click. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded bg-accent" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-accent/70" />
      </div>

      <div className="h-4 w-[28rem] max-w-full animate-pulse rounded bg-accent/70" />

      <div className="overflow-hidden rounded-md border">
        <div className="h-9 border-b bg-sidebar" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-3 py-3 last:border-0">
            <div className="h-4 w-40 animate-pulse rounded bg-accent" />
            <div className="h-3 w-24 animate-pulse rounded bg-accent/60 max-md:hidden" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-accent/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
