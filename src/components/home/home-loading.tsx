import { Skeleton } from "@/components/shadcn/skeleton";

/** Home's shape while its modules' figures load: the title and date
 *  line, then group panels of module rows in two columns from 1024px, as HomeView lays them
 *  out. Like `PageLoading` it costs no query and shows no spinner; the pulse stops under
 *  reduced motion. */
export function HomeLoading() {
  const panel = (rows: number) => (
    <div className="pc-panel">
      <Skeleton className="h-(--pc-leading-title) w-32 max-w-full" />
      <ul className="pc-rows">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="pc-row">
            <span aria-hidden="true" className="pc-tile-icon" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-(--pc-leading-body) w-28 max-w-full" />
              <Skeleton className="h-(--pc-leading-caption) w-64 max-w-full" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col gap-4">
      <span className="sr-only">Loading your apps</span>
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-(--pc-leading-page) w-44 max-w-full" />
        <Skeleton className="h-(--pc-leading-caption) w-72 max-w-full" />
      </div>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">{panel(3)}{panel(2)}</div>
        <div className="flex min-w-0 flex-col gap-4">{panel(4)}</div>
      </div>
    </div>
  );
}
