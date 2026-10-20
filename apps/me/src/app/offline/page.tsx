"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, CloudDownload } from "lucide-react";
import { Frame } from "@/components/frame";
import { useOffline } from "@/components/offline";
import { EmptyRows } from "@/components/ui";
import { session } from "@/lib/api";
import { date } from "@/lib/format";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

const noSubscription = () => () => {};

/** Courses kept on this phone for when there's no signal. Also the page the
 *  app shows when a page that wasn't saved is opened offline (public/sw.js). */
export default function OfflinePage() {
  const router = useRouter();
  const token = useSyncExternalStore(noSubscription, () => session.token(), () => undefined);
  const { offline, saved } = useOffline();
  useEffect(() => { if (token === null) router.replace(`/sign-in?next=${encodeURIComponent("/offline")}`); }, [token, router]);
  if (!token) return null;
  return (
    <Frame title="Saved for offline">
      <PageShell header={<PageHeader title="Saved for offline"
        description={offline ? "With no signal, these courses still open. Anything else waits until you’re back online." : "These courses open even with no signal. Save one from its course page."} />}>
        <section className="pc-panel" aria-label="Saved courses">
          {saved.length ? (
            <ul className="pc-rows">{saved.map((course) => (
              <li key={course.id}><Link href={`/training/${course.id}`} className="pc-row">
                <span className="pc-tile-icon"><CloudDownload aria-hidden="true" /></span>
                <span className="pc-row-body"><span className="pc-row-title">{course.title}</span>
                  <span className="pc-row-hint">{`${course.lessons} ${course.lessons === 1 ? "lesson" : "lessons"} · saved ${date(course.savedAt)}`}</span></span>
                <span className="pc-row-trail"><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
              </Link></li>
            ))}</ul>
          ) : <EmptyRows>Nothing saved on this phone yet.</EmptyRows>}
        </section>
        <p className="caption">Saved courses are removed after 30 days without being brought up to date, and when you sign out.</p>
      </PageShell>
    </Frame>
  );
}
