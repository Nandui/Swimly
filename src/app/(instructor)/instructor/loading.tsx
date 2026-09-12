import { Skeleton } from "@/components/shadcn/skeleton";

export default function Loading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
    <span className="sr-only">Loading classes</span>
    <Skeleton className="h-8 w-56" /><Skeleton className="h-11 w-full max-w-sm" />
    {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
  </div>;
}
