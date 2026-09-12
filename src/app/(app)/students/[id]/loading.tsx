import { Skeleton } from "@/components/shadcn/skeleton";
import styles from "@/components/students/swimmer-profile.module.css";

export default function LoadingSwimmerProfile() {
  return <section role="status" aria-label="Loading swimmer profile" className={styles.profile}>
    <span className="sr-only">Loading swimmer profile…</span>
    <div className="flex h-11 items-center"><Skeleton className="h-5 w-24" /></div>
    <div className={styles.header}><div className={styles.identity}><Skeleton className={styles.avatar} /><div className="min-w-0 space-y-2"><Skeleton className="h-8 w-48 max-w-full" /><Skeleton className="h-5 w-52 max-w-full" /></div></div><Skeleton className="h-9 w-56 max-w-full" /></div>
    <div><Skeleton className="h-12 w-full" />
      <div className={styles.body}><div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div><Skeleton className="h-80 w-full" /></div>
    </div>
  </section>;
}
