import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatDateTime, plural } from "@/lib/format";
import { HR_ACTIVITY_PAGE_SIZE, hrActivity } from "@/modules/hr/lib/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "Who read what" };

/** Superadmins only: the HR read log and change log, newest first. */
export default async function HrActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireFreshSession("hr.records.read", "/hr/activity");
  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  const { reads, changes, readsTotal, changesTotal } = await hrActivity(page);
  return (
    <>
      <PageHeader title="Who read what" description="Every time someone opened an HR record, and every change, newest first." />
      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="hr-reads">
          <div className="pc-panel-head"><h2 id="hr-reads">Reads</h2></div>
          {reads.length === 0 ? <EmptyState compact icon="userSearch" title={page > 1 ? "No more reads" : "Nobody has opened an HR record yet"} /> : (
            <ul className="pc-feed">{reads.map((r) => {
              const { line, caption } = readSentence(r);
              return (
                <li key={r.id}>
                  <span className="pc-feed-dot" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">{line}</span>
                    <span className="block text-xs text-ui-muted-foreground">{[formatDateTime(new Date(r.at)), caption].filter(Boolean).join(" · ")}</span>
                  </span>
                </li>
              );
            })}</ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="hr-changes">
          <div className="pc-panel-head"><h2 id="hr-changes">Changes</h2></div>
          {changes.length === 0 ? <EmptyState compact icon="scrollText" title={page > 1 ? "No more changes" : "No changes yet"} /> : (
            <ul className="pc-feed">{changes.map((c) => (
              <li key={c.id}>
                <span className="pc-feed-dot" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold break-words">{c.actorName}: {c.summary}</span>
                  <span className="block text-xs text-ui-muted-foreground">{formatDateTime(new Date(c.at))}</span>
                </span>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
      <LinkPagination label="Activity pages" page={page} totalItems={Math.max(readsTotal, changesTotal)} pageSize={HR_ACTIVITY_PAGE_SIZE} pathname="/hr/activity" query={{}} />
    </>
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
