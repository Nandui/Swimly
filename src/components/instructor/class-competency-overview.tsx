import { EmptyState } from "@/components/ui-kit/empty-state";
import { Card } from "@/components/shadcn/card";
import type { CompetencyStatus } from "@/generated/prisma/client";

/** Class totals use saved, shared marks and include every enrolled swimmer. */
export function ClassCompetencyOverview({ competencies, swimmers }: {
  competencies: { id: string; name: string }[];
  swimmers: { marks: Record<string, CompetencyStatus | null> }[];
}) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Class overview</h2>
        <p className="max-w-prose text-sm text-ui-muted-foreground">
          Saved progress for all enrolled swimmers, including those absent.
          Save marks in Competencies to update these totals.
        </p>
      </div>
      {!swimmers.length ? <EmptyState compact title="No swimmers are currently enrolled in this class." />
        : !competencies.length ? <EmptyState compact title="This level has no competencies yet." /> : (
          <ul aria-label="Competency totals" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-3">
            {competencies.map(competency => {
              const achieved = swimmers.filter(swimmer => swimmer.marks[competency.id] === "ACHIEVED").length;
              return (
                <li key={competency.id} className="min-w-0">
                  <Card className="h-full min-w-0 justify-between gap-6 p-4 shadow-none sm:p-5">
                    <h3 className="break-words text-sm leading-snug font-semibold sm:text-base">{competency.name}</h3>
                    <p className="text-sm tabular-nums text-ui-muted-foreground">
                      <span className="text-2xl font-semibold text-ui-foreground">{achieved}</span> out of {swimmers.length} achieved
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
