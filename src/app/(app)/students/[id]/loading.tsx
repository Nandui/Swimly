import { Skeleton } from "@/components/shadcn/skeleton";

export default function LoadingSwimmerProfile() {
  return <section role="status" aria-label="Loading swimmer profile" className="space-y-6 p-2">
    <span className="sr-only">Loading swimmer profile…</span>
    <Skeleton className="h-6 w-24" />
    <div className="flex items-center gap-5"><Skeleton className="size-16 rounded-full" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-8 w-56 max-w-full" /><Skeleton className="h-4 w-64 max-w-full" /></div></div>
    <Skeleton className="h-11 w-full" />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]"><div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div><Skeleton className="h-80 w-full" /></div>
  </section>;
}
