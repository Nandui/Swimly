import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ArchivePosition, PositionDialog } from "@/components/setup/positions";
import { plural } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { positionsPage } from "@/lib/setup/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Positions" };

/** The jobs people hold (Admin, People; owner decision, 8 October 2026), each with the
 *  qualifications it needs. A person's profile picks one; their HR file and Training's expiring
 *  list say what they are missing. Separate from roles, which decide access. */
export default async function PositionsPage() {
  await screenPage("positions", "setup.view");
  const { positions, qualifications, canKeep } = await positionsPage();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Positions" description="The jobs people hold, and the qualifications each needs. A position does not give access: that is the person's role."
        actions={canKeep ? <PositionDialog qualifications={qualifications} /> : undefined} />
      {positions.length === 0 ? (
        <EmptyState icon="users" title="No positions yet" hint="Add the jobs people do, such as Lifeguard, Swim teacher, Receptionist and Duty manager." />
      ) : (
        <section aria-label="Positions" className="pc-panel">
          <ul className="pc-rows">
            {positions.map((p) => (
              <li key={p.id} className="pc-row" {...(p.archived ? { "data-muted": "" } : {})}>
                <span className="pc-tile-icon" aria-hidden="true"><BadgeCheck /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{p.requires.length ? `Needs ${p.requires.map((r) => r.name).join(", ")}` : "Needs no qualifications"} · {plural(p.holders, "person", "people")}</span>
                </span>
                <span className="pc-row-trail">
                  {p.archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                  {canKeep ? <><PositionDialog position={p} qualifications={qualifications} /><ArchivePosition id={p.id} name={p.name} archived={p.archived} /></> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
