import { Skeleton } from "@/components/shadcn/skeleton";
import { cn } from "@/lib/utils";

/** What every page shows for the moment between a click and its data.
 *
 *  Without this, nothing paints until the slowest query on the destination
 *  page has answered — the shell, the title, all of it waits. This file makes
 *  Next wrap each page in a Suspense boundary, so the sidebar and this
 *  placeholder arrive at once and the real page streams in behind them. It is
 *  the cheapest "feels faster" the app can have, because it costs no query.
 *
 *  Shaped like every page: a title, a description line, a sentence, rows. No
 *  spinner — a spinner says "wait", a page-shaped placeholder says "here it
 *  comes". */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="min-w-0 flex flex-col gap-6"
    >
      <span className="sr-only">Loading</span>

      <div className="min-w-0 flex flex-col gap-2">
        <Skeleton style={{ width: 176, height: 28 }} />
        <Skeleton style={{ width: "min(20rem, 100%)", height: 16 }} />
      </div>

      <Skeleton style={{ width: "min(28rem, 100%)", height: 16 }} />

      <div className="min-w-0 flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="min-w-0 flex gap-4 items-center">
            <Skeleton style={{ width: 160, height: 16 }} />
            <Skeleton
              style={{ width: 96, height: 12 }}
              className={"max-md:hidden"}
            />
            <div className={cn("min-w-0", "ml-auto")}>
              <Skeleton style={{ width: 64, height: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
