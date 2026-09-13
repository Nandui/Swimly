import { Skeleton } from "@/components/shadcn/skeleton";

export default function ScheduleLoading() {
  return <section role="status" aria-busy="true" className="space-y-6">
    <span className="sr-only">Loading schedule</span>
    <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 max-w-full" /></div>
    <Skeleton className="h-20 w-full rounded-ui-lg motion-reduce:animate-none" />
    <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-11 w-56 max-w-full" /></div>
    <Skeleton className="h-96 w-full rounded-ui-lg" />
  </section>;
}
