import type { Metadata } from "next";
import { VStack } from "@astryxdesign/core/Stack";
import { ActivityTable } from "@/components/activity-table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { ACTIVITY_PER_PAGE, getActivity } from "@/lib/activity/data/audit-log";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage(props: PageProps<"/activity">) {
  await screenPage("activity", "activity.view");
  const params = await props.searchParams;
  const requested = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const { entries, total, page } = await getActivity(requested);

  const first = total === 0 ? 0 : (page - 1) * ACTIVITY_PER_PAGE + 1;
  const last = (page - 1) * ACTIVITY_PER_PAGE + entries.length;

  return (
    <VStack gap={6}>
      <PageHeader
        title="Activity"
        description="Who changed what, and when. Every mutation writes a row here — scripts included."
      />

      {total === 0 ? (
        <EmptyState
          icon="scrollText"
          title="The trail is empty"
          hint="Nothing has been created, updated or deleted yet."
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
              query={{}}
            />
          ) : null}
        </>
      )}
    </VStack>
  );
}
