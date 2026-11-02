import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SearchField } from "@/components/ui-kit/search-field";
import { minutesNow, nameInitials, plural, today } from "@/lib/format";
import { ReportDialog, reportablePeople } from "@/modules/hr/features/report";

export const metadata: Metadata = { title: "Report" };

/** Quick reports (D22). Names only, so no fresh sign-in: filing reads no HR record. */
export default async function HrReportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { who, people } = await reportablePeople(q).catch(() => notFound());
  const minutes = minutesNow();
  const now = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Report" description={who.records
      ? "Put an issue with a member of staff on their HR file."
      : "Put an issue with someone you manage on their HR file. They are not told, and you can't open it again."} />}>
      <section className="flex min-w-0 flex-col gap-(--space-4)" aria-label="People">
        <form method="get" role="search" aria-label="Find a person">
          <SearchField label="Person" placeholder="Name" name="q" defaultValue={q} clearHref={q ? "/hr/report" : undefined} />
        </form>
        {people.length > 0 ? <p className="text-xs text-ui-muted-foreground">{plural(people.length, "person", "people")}{people.length === 30 ? ", search for more" : ""}</p> : null}
        {people.length === 0 ? (
          <EmptyState as="h2" role="status" icon="users" title="Nobody to show"
            hint={q ? "Nobody you can report on matches that name." : "You can report on the people you manage. Ask an administrator to set you as their manager in Admin › People."} />
        ) : (
          <ul className="pc-list">
            {people.map((p) => (
              <li key={p.id} className="pc-row">
                <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(p.name)}</AvatarFallback></Avatar>
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{p.jobTitle || "No job title"}</span>
                </span>
                <span className="pc-row-trail">
                  <ReportDialog subjectUserId={p.id} name={p.name} today={today()} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
