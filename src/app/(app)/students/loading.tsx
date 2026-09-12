import { Skeleton } from "@/components/shadcn/skeleton";

export default function LoadingSwimmers() {
  return <div className="space-y-6" role="status" aria-label="Loading swimmers">
    <div className="space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-2/3" /></div>
    <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-72 max-w-full" />
    <div className="space-y-1">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-22 w-full" />)}</div>
    <span className="sr-only">Loading swimmers…</span>
  </div>;
}
