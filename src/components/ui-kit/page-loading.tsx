import { Skeleton } from "@/components/shadcn/skeleton";

/** What a page shows for the moment between a click and its data.
 *
 *  Every `loading.tsx` re-exports this, so Next wraps each page in a Suspense
 *  boundary: the frame and this placeholder arrive at once and the real page
 *  streams in behind them. It costs no query.
 *
 *  Shaped like every v2 page (DESIGN.md, "States"): a title and a description
 *  line on the canvas, then a white panel of row cards. `tiles` adds the
 *  figure tiles a report page opens with. Bars use the line colour so they
 *  show on the white panel in both themes. No spinner: a spinner says "wait",
 *  a page-shaped placeholder says "here it comes". */
export function PageLoading({ tiles = false }: { tiles?: boolean }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="min-w-0 flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <div className="min-w-0 flex flex-col gap-2">
        <Skeleton className="h-(--pc-leading-page) w-44 max-w-full" />
        <Skeleton className="h-(--pc-leading-caption) w-80 max-w-full" />
      </div>
      {tiles ? (
        <div className="pc-stats">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="pc-stat">
              <Skeleton className="h-(--pc-leading-caption) w-24 max-w-full" />
              <Skeleton className="h-(--pc-leading-figure) w-16 max-w-full" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="pc-panel">
        <ul className="pc-rows">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="pc-row">
              <Skeleton className="h-(--pc-leading-caption) w-40 max-w-[60%]" />
              <Skeleton className="h-(--pc-leading-caption) w-16 ml-auto" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
