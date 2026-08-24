import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ActivityTable } from "@/components/activity-table";
import { getActivity } from "@/lib/activity/data/audit-log";

export const metadata: Metadata = { title: "Activity" };

const LIMIT = 200;

export default async function ActivityPage() {
  const entries = await getActivity(LIMIT);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Who changed what, and when. Every mutation writes a row here — scripts included."
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="The trail is empty"
          hint="Nothing has been created, updated or deleted yet."
        />
      ) : (
        <>
          <p className="max-w-prose text-sm text-muted-foreground">
            The{" "}
            <span className="font-medium text-foreground tabular-nums">{entries.length}</span>{" "}
            most recent {entries.length === 1 ? "entry" : "entries"}, newest first.
            {entries.length === LIMIT ? " Older entries are not shown." : ""}
          </p>
          <ActivityTable entries={entries} />
        </>
      )}
    </div>
  );
}
