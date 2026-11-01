import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordHistory, RecordSection } from "@/components/ui-kit/record";
import { formatDateTime, plural } from "@/lib/format";
import { HR_ACTIVITY_PAGE_SIZE, hrActivity } from "@/modules/hr/features/activity";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "Who read what" };

/** Superadmins only: the HR read log and change log, newest first. */
export default async function HrActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireFreshSession("hr.records.read", "/hr/activity");
  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  const { reads, changes, readsTotal, changesTotal } = await hrActivity(page);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Who read what" description="Every time someone opened an HR record, and every change, newest first." />}>
      <div className="grid min-w-0 items-start gap-(--space-7) lg:grid-cols-2">
        <RecordSection id="hr-reads" title="Reads" aside={readsTotal ? <p>{readsTotal}</p> : null}>
          {reads.length === 0 ? <EmptyState compact icon="userSearch" title={page > 1 ? "No more reads" : "Nobody has opened an HR record yet"} /> : (
            <RecordHistory items={reads.map((r) => {
              const { line, caption } = readSentence(r);
              return { key: r.id, title: line, meta: [formatDateTime(new Date(r.at)), caption].filter(Boolean).join(" · ") };
            })} />
          )}
        </RecordSection>
        <RecordSection id="hr-changes" title="Changes" aside={changesTotal ? <p>{changesTotal}</p> : null}>
          {changes.length === 0 ? <EmptyState compact icon="scrollText" title={page > 1 ? "No more changes" : "No changes yet"} /> : (
            <RecordHistory items={changes.map((c) => ({ key: c.id, title: `${c.actorName}: ${c.summary}`, meta: formatDateTime(new Date(c.at)) }))} />
          )}
        </RecordSection>
      </div>
      <LinkPagination label="Activity pages" page={page} totalItems={Math.max(readsTotal, changesTotal)} pageSize={HR_ACTIVITY_PAGE_SIZE} pathname="/hr/activity" query={{}} />
    </PageShell>
  );
}

type Read = Awaited<ReturnType<typeof hrActivity>>["reads"][number];

/** A read as a sentence, built from the stored entity so old and new rows read the same.
 *  The stored purpose stays as written: it is audit data, shown in the subject export. */
function readSentence(r: Read): { line: string; caption?: string } {
  const subject = r.subjects[0] ?? "someone";
  const own = r.subjectUserIds.length === 1 && r.subjectUserIds[0] === r.actorId;
  switch (r.entity) {
    case "HrPeople": return { line: `${r.actorName} opened the people list`, caption: plural(r.subjects.length, "person", "people") };
    case "HrRecord": return { line: own ? `${r.actorName} opened their own record${r.purpose.includes("Turnfin Me") ? " in Turnfin Me" : ""}` : `${r.actorName} opened ${subject}’s record` };
    case "HrReview": return { line: `${r.actorName} opened ${subject}’s review` };
    case "HrExport": return { line: `${r.actorName} exported ${subject}’s record` };
    default: return { line: `${r.actorName} opened ${r.purpose}`, caption: r.subjects.length > 3 ? `${r.subjects.slice(0, 3).join(", ")} and ${r.subjects.length - 3} more` : r.subjects.join(", ") };
  }
}
