import { Skeleton } from '@/components/shadcn/skeleton';

export default function Loading() {
  return (
    <div className="loading-page" role="status">
      <Skeleton className="loading-line" />
      <div className="loading-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <p>Loading your workspace…</p>
    </div>
  );
}
