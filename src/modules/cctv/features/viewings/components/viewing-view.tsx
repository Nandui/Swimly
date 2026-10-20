import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CctvViewingDetail } from "@/modules/cctv/features/viewings/server/data";
import { incidentLabel, reasonMeta } from "@/modules/cctv/shared/rules";

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm text-ui-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-words">{children}</dd>
    </div>
  );
}

/** A saved entry as it was written, then its notes in the order they were added. */
export function ViewingView({ data }: { data: CctvViewingDetail }) {
  const v = data.viewing;
  const canOpenIncidents = data.canOpenIncidents;
  return (
    <>
      <section aria-labelledby="cctv-v-who" className="pc-panel flex flex-col gap-4">
        <h2 id="cctv-v-who">Who checked it, and when</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label="Checked by">{v.checkedBy}</Fact>
          <Fact label="When">{day(v.viewedOn)} at {v.viewedAt}</Fact>
          <Fact label="Anyone else watching">{v.othersPresent || "Nobody"}</Fact>
          <Fact label="Site">{v.site.name}</Fact>
        </dl>
      </section>
      <section aria-labelledby="cctv-v-why" className="pc-panel flex flex-col gap-4">
        <h2 id="cctv-v-why">Why it was checked</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label="Reason">{reasonMeta(v.reason).label}</Fact>
          <Fact label="Incident report">
            {v.incidentNumber ? (canOpenIncidents ? <Link className="underline underline-offset-4" href={`/incidents/number/${v.incidentNumber}`}>{incidentLabel(v.incidentNumber)}</Link> : incidentLabel(v.incidentNumber)) : "None"}
          </Fact>
          <Fact label="What led to the check" wide>{v.background}</Fact>
          <Fact label="What they were looking for" wide>{v.purpose}</Fact>
        </dl>
      </section>
      <section aria-labelledby="cctv-v-what" className="pc-panel flex flex-col gap-4">
        <h2 id="cctv-v-what">What was watched, and what was seen</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label="Cameras">{v.cameras}</Fact>
          <Fact label="Footage">{day(v.footageOn)}, {v.footageFrom} to {v.footageTo}</Fact>
          <Fact label="What was seen" wide>{v.findings}</Fact>
          <Fact label="Copies saved or handed over" wide>{v.copies || "None"}</Fact>
        </dl>
        <p className="flex items-center gap-2 text-sm text-ui-muted-foreground"><Lock aria-hidden="true" className="size-4" />Recorded by {v.recordedByName}, {formatDateTime(v.createdAt)}. It can’t be changed or deleted.</p>
      </section>
      <section aria-labelledby="cctv-v-notes" className="pc-panel">
        <div className="pc-panel-head"><h2 id="cctv-v-notes">Notes added later</h2></div>
        {v.notes.length === 0 ? <p className="text-sm text-ui-muted-foreground">No notes yet.</p> : (
          <ul className="pc-rows">
            {v.notes.map((n) => (
              <li key={n.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="whitespace-pre-line break-words">{n.text}</span>
                  <span className="pc-row-hint">{n.byName}, {formatDateTime(n.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
