import type { Metadata } from "next";
import { Card } from "@/components/shadcn/card";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatDateTime } from "@/lib/format";
import { hrActivity } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "Who read what" };

/** Superadmins only: the HR read log and change log, newest first. */
export default async function HrActivityPage() {
  await requireFreshSession("hr.records.read", "/hr/activity");
  const { reads, changes } = await hrActivity();
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title="Who read what" description="Every time someone opened an HR record, and every change. The last 100 of each." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3 p-5 shadow-none" aria-labelledby="hr-reads">
          <h2 id="hr-reads" className="text-lg font-semibold">Reads</h2>
          {reads.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody has opened an HR record yet.</p> : (
            <ul className="divide-y divide-ui-border">{reads.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <p><span className="font-medium">{r.actorName}</span> opened {r.purpose}</p>
                <p className="text-xs text-ui-muted-foreground">{formatDateTime(new Date(r.at))} · {r.subjects.length > 3 ? `${r.subjects.slice(0, 3).join(", ")} and ${r.subjects.length - 3} more` : r.subjects.join(", ")}</p>
              </li>
            ))}</ul>
          )}
        </Card>
        <Card className="gap-3 p-5 shadow-none" aria-labelledby="hr-changes">
          <h2 id="hr-changes" className="text-lg font-semibold">Changes</h2>
          {changes.length === 0 ? <p className="text-sm text-ui-muted-foreground">No changes yet.</p> : (
            <ul className="divide-y divide-ui-border">{changes.map((c) => (
              <li key={c.id} className="space-y-1 py-3">
                <p><span className="font-medium">{c.actorName}</span>: {c.summary}</p>
                <p className="text-xs text-ui-muted-foreground">{formatDateTime(new Date(c.at))}</p>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
