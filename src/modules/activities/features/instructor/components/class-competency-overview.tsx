import { EmptyState } from "@/components/ui-kit/empty-state";
import type { CompetencyStatus } from "@/generated/prisma/client";

/** Class totals use saved, shared marks and include every enrolled swimmer. */
export function ClassCompetencyOverview({ competencies, swimmers }: {
  competencies: { id: string; name: string }[];
  swimmers: { marks: Record<string, CompetencyStatus | null> }[];
}) {
  return (
    <section className="pc-panel" aria-labelledby="class-overview">
      <div className="pc-panel-head">
        <div className="min-w-0">
          <h2 id="class-overview">Class overview</h2>
          <p className="pc-row-hint">
            Saved progress for all enrolled swimmers, including those absent.
            Save marks in Competencies to update these totals.
          </p>
        </div>
      </div>
      {!swimmers.length ? <EmptyState compact icon="users" title="No swimmers enrolled" hint="Nobody is enrolled in this class at the moment." />
        : !competencies.length ? <EmptyState compact icon="clipboardList" title="No competencies yet" hint="This level has no competencies to mark." /> : (
          <ul aria-label="Competency totals" className="pc-stats pc-stats-fill m-0 list-none p-0">
            {competencies.map(competency => {
              const achieved = swimmers.filter(swimmer => swimmer.marks[competency.id] === "ACHIEVED").length;
              return (
                <li key={competency.id} className="pc-stat">
                  <h3 className="pc-row-title break-words">{competency.name}</h3>
                  {/* Figure inline with its words, so the line reads "2 out of 5 achieved". */}
                  <p className="pc-row-hint"><span className="pc-stat-figure text-ui-foreground">{achieved}</span> out of {swimmers.length} achieved</p>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}
