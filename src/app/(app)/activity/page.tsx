import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Button } from "@/components/ui/button";
import { ActivityTable } from "@/components/activity-table";
import { ACTIVITY_PER_PAGE, getActivity } from "@/lib/activity/data/audit-log";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage(props: PageProps<"/activity">) {
  const params = await props.searchParams;
  const requested = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const { entries, total, page } = await getActivity(requested);

  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PER_PAGE));
  const first = total === 0 ? 0 : (page - 1) * ACTIVITY_PER_PAGE + 1;
  const last = (page - 1) * ACTIVITY_PER_PAGE + entries.length;
  const hrefFor = (n: number) => ({
    pathname: "/activity",
    query: n > 1 ? { page: String(n) } : {},
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Who changed what, and when. Every mutation writes a row here — scripts included."
      />

      {total === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="The trail is empty"
          hint="Nothing has been created, updated or deleted yet."
        />
      ) : (
        <>
          <p className="max-w-prose text-sm text-muted-foreground">
            Entries{" "}
            <span className="font-medium text-foreground tabular-nums">
              {first}–{last}
            </span>{" "}
            of <span className="font-medium text-foreground tabular-nums">{total}</span>, newest
            first.
          </p>

          <ActivityTable entries={entries} />

          {pages > 1 ? (
            <nav
              aria-label="Pages of the trail"
              className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
            >
              <Button
                asChild
                variant="outline"
                size="sm"
                className={page <= 1 ? "invisible" : undefined}
              >
                <Link href={hrefFor(page - 1)} rel="prev">
                  <ChevronLeft className="size-4" />
                  Newer
                </Link>
              </Button>
              <span className="tabular-nums">
                Page {page} of {pages}
              </span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className={page >= pages ? "invisible" : undefined}
              >
                <Link href={hrefFor(page + 1)} rel="next">
                  Older
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
