import { Skeleton } from "@/components/shadcn/skeleton";

/** Home's shape while its apps' lines load (DESIGN.md, States): the greeting and date line, the
 *  day's card, then "Needs you" beside "Right now", as HomeView lays them out. Like `PageLoading`
 *  it costs no query and shows no spinner; the pulse stops under reduced motion. */
export function HomeLoading() {
  const rows = (count: number) => (
    <ul className="pc-list">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="pc-row">
            <span aria-hidden="true" className="pc-tile-icon" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-(--type-body-leading) w-40 max-w-full" />
              <Skeleton className="h-(--type-caption-leading) w-56 max-w-full" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col gap-6">
      <span className="sr-only">Loading Home</span>
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-(--type-large-title-leading) w-72 max-w-full" />
        <Skeleton className="h-(--type-body-leading) w-80 max-w-full" />
      </div>
      <div className="pc-panel"><Skeleton className="h-(--type-title-leading) w-40 max-w-full" /><Skeleton className="h-32 w-full" /></div>
      <div className="grid min-w-0 items-start gap-(--space-7) lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2"><Skeleton className="h-(--type-title-leading) w-28" />{rows(4)}</div>
        <div className="flex min-w-0 flex-col gap-2"><Skeleton className="h-(--type-title-leading) w-28" />{rows(3)}</div>
      </div>
    </div>
  );
}
