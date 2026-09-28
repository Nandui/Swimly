import type { Metadata } from "next";
import Link from "next/link";

import { ActivityTable } from "@/components/activity-table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { ACTIVITY_PER_PAGE, getActivity } from "@/lib/activity/data/audit-log";
import { screenPage } from "@/lib/page-guards";
import { Button } from "@/components/shadcn/button";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage(props: PageProps<"/activity">) {
  await screenPage("activity", "activity.view");
  const params = await props.searchParams;
  const requested = Math.max(
    1,
    Number(typeof params.page === "string" ? params.page : 1) || 1,
  );

  const modules = allModules().map((m) => m.logName);
  const moduleName = typeof params.module === "string" && modules.includes(params.module) ? params.module : undefined;
  const { entries, total, page } = await getActivity(requested, moduleName);

  const first = total === 0 ? 0 : (page - 1) * ACTIVITY_PER_PAGE + 1;
  const last = (page - 1) * ACTIVITY_PER_PAGE + entries.length;

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title="Activity" description="Who changed what, and when." />

      <nav aria-label="Filter by module" className="flex flex-wrap gap-2">
        {[undefined, ...modules].map((name) => (
          <Button key={name ?? "all"} asChild size="sm" variant={name === moduleName ? "default" : "outline"} className="min-h-11">
            <Link href={name ? `/activity?module=${encodeURIComponent(name)}` : "/activity"} aria-current={name === moduleName ? "page" : undefined}>{name ?? "Every module"}</Link>
          </Button>
        ))}
      </nav>

      {total === 0 ? (
        <EmptyState
          icon="scrollText"
          title="The trail is empty"
          hint={moduleName ? `Nothing in ${moduleName} yet. Entries from before 28 September 2026 have no module.` : "Nothing has been created, updated or deleted yet."}
        />
      ) : (
        <>
          <Lead>
            Entries{" "}
            <Num>
              {first}–{last}
            </Num>{" "}
            of <Num>{total}</Num>, newest first.
          </Lead>

          <ActivityTable entries={entries} />

          {total > ACTIVITY_PER_PAGE ? (
            <LinkPagination
              label="Pages of the trail"
              page={page}
              totalItems={total}
              pageSize={ACTIVITY_PER_PAGE}
              pathname="/activity"
              query={moduleName ? { module: moduleName } : {}}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
