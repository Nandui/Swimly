import { Skeleton } from "@/components/shadcn/skeleton";

export default function LoadingClasses() {
  return <div className="space-y-5" role="status" aria-label="Loading classes"><div className="space-y-2"><Skeleton className="h-8 w-36" /><Skeleton className="h-4 w-2/3" /></div><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full max-w-lg" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div>{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}<span className="sr-only">Loading classes…</span></div>;
}
