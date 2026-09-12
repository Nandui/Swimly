import { Skeleton } from "@/components/shadcn/skeleton";

export default function TodayLoading() {
  return <section role="status" aria-busy="true" className="space-y-6">
    <span className="sr-only">Loading today’s schedule</span>
    <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 max-w-full" /></div>
    <div className="flex flex-wrap gap-3"><Skeleton className="h-11 w-48" /><Skeleton className="h-11 w-56" /></div>
    <Skeleton className="h-96 w-full rounded-ui-lg" />
  </section>;
}
