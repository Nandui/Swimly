import { Skeleton } from "@/components/shadcn/skeleton";

export default function AnalyticsLoading() {
  return <div role="status" aria-label="Loading analytics" className="space-y-6">
    <div className="space-y-2"><Skeleton className="h-8 w-36 motion-reduce:animate-none" /><Skeleton className="h-4 w-64 max-w-full motion-reduce:animate-none" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map(index => <Skeleton key={index} className="h-52 rounded-ui-xl motion-reduce:animate-none" />)}
      <Skeleton className="h-96 rounded-ui-xl motion-reduce:animate-none sm:col-span-2" />
      <Skeleton className="h-96 rounded-ui-xl motion-reduce:animate-none" />
    </div>
  </div>;
}
