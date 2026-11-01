import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Route } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { listPaths, PathDialog } from "@/modules/training/features/paths";
import { listCourses } from "@/modules/training/features/courses";

export const metadata: Metadata = { title: "Learning paths" };

/** Learning paths (e-learning phase 5): a programme of courses in order, such
 *  as a new lifeguard's first month. Building them needs the Author level. */
export default async function PathsPage() {
  const [{ who, paths }, catalogue] = await Promise.all([listPaths(), listCourses()]);
  const courses = catalogue.courses.filter((c) => !c.archivedAt).map((c) => ({ id: c.id, title: c.title }));
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Learning paths" description="Courses in order for a new starter or a new role, each due a number of days after they start. Put people on a path to assign them all at once."
        actions={who.manage ? <PathDialog courses={courses} /> : null} />}>
      {paths.length === 0 ? (
        <EmptyState as="h2" icon="graduation" title="No learning paths yet" hint={who.manage ? "Add one for your inductions, for example a new lifeguard's first month." : "Someone with the Author level in Training can add them."} />
      ) : (
        <RecordSection id="paths-heading" title={who.manage ? "Paths" : "Learning paths"} aside={<p>{paths.length}</p>}>
          <ul className="pc-list">
            {paths.map((p) => (
              <li key={p.id}>
                <Link href={`/training/paths/${p.id}`} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Route /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{p.title}</span>
                    <span className="pc-row-hint">{p.courses.length} {p.courses.length === 1 ? "course" : "courses"} over {p.days} {p.days === 1 ? "day" : "days"}: {p.courses.join(", ")}</span>
                    {p.summary ? <span className="pc-row-hint">{p.summary}</span> : null}
                  </span>
                  <span className="pc-row-trail">
                    <span className="pc-row-value">{p.enrolled} on it</span>
                    {p.archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </RecordSection>
      )}
    </PageShell>
  );
}
