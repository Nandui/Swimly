import Link from "next/link";
import { Lock } from "lucide-react";
import { RecordFact, RecordFacts, RecordHistory, RecordSection } from "@/components/ui-kit/record";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CctvViewingDetail } from "@/modules/cctv/features/viewings/server/data";
import { incidentLabel, reasonMeta } from "@/modules/cctv/shared/rules";

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** A saved entry as it was written, then its notes in the order they were added. */
export function ViewingView({ data }: { data: CctvViewingDetail }) {
  const v = data.viewing;
  const canOpenIncidents = data.canOpenIncidents;
  return (
    <>
      <RecordSection id="cctv-v-who" title="Who checked it, and when">
        <div className="rec-card">
          <RecordFacts>
            <RecordFact label="Checked by">{v.checkedBy}</RecordFact>
            <RecordFact label="When">{day(v.viewedOn)} at {v.viewedAt}</RecordFact>
            <RecordFact label="Anyone else watching">{v.othersPresent || "Nobody"}</RecordFact>
            <RecordFact label="Site">{v.site.name}</RecordFact>
          </RecordFacts>
        </div>
      </RecordSection>
      <RecordSection id="cctv-v-why" title="Why it was checked">
        <div className="rec-card">
          <RecordFacts>
            <RecordFact label="Reason">{reasonMeta(v.reason).label}</RecordFact>
            <RecordFact label="Incident report">
              {v.incidentNumber ? (canOpenIncidents ? <Link className="underline underline-offset-4" href={`/incidents/number/${v.incidentNumber}`}>{incidentLabel(v.incidentNumber)}</Link> : incidentLabel(v.incidentNumber)) : "None"}
            </RecordFact>
            <RecordFact label="What led to the check" wide>{v.background}</RecordFact>
            <RecordFact label="What they were looking for" wide>{v.purpose}</RecordFact>
          </RecordFacts>
        </div>
      </RecordSection>
      <RecordSection id="cctv-v-what" title="What was watched, and what was seen">
        <div className="rec-card">
          <RecordFacts>
            <RecordFact label="Cameras">{v.cameras}</RecordFact>
            <RecordFact label="Footage">{day(v.footageOn)}, {v.footageFrom} to {v.footageTo}</RecordFact>
            <RecordFact label="What was seen" wide>{v.findings}</RecordFact>
            <RecordFact label="Copies saved or handed over" wide>{v.copies || "None"}</RecordFact>
          </RecordFacts>
          <p className="flex items-center gap-2 text-sm text-ui-muted-foreground"><Lock aria-hidden="true" className="size-4" />Recorded by {v.recordedByName}, {formatDateTime(v.createdAt)}. It can’t be changed or deleted.</p>
        </div>
      </RecordSection>
      <RecordSection id="cctv-v-notes" title="Notes added later" aside={v.notes.length ? <p>{v.notes.length}</p> : null}>
        {v.notes.length === 0 ? <p className="pc-section-note">No notes yet.</p> : (
          <RecordHistory items={v.notes.map((n) => ({ key: n.id, title: n.byName, meta: formatDateTime(n.createdAt), note: n.text }))} />
        )}
      </RecordSection>
    </>
  );
}
