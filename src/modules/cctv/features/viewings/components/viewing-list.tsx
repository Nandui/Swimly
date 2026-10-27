import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, plural } from "@/lib/format";
import type { CctvViewingRow } from "@/modules/cctv/features/viewings/server/data";
import { incidentLabel, reasonMeta, viewingNumber } from "@/modules/cctv/shared/rules";

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** One section of entries, newest first: one row each with why, where, when and who. */
export function ViewingPanel({ id, title, rows, empty }: { id: string; title: string; rows: CctvViewingRow[]; empty: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} className="flex min-w-0 flex-col">
      <div className="pc-section-head"><h2 id={`${id}-h`}>{title}</h2>{rows.length ? <p>{rows.length}</p> : null}</div>
      {rows.length === 0 ? <EmptyState compact icon="clipboardList" title={empty.title} hint={empty.hint} /> : (
        <ul className="pc-list">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/cctv/${r.id}`} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{r.purpose}</span>
                  <span className="pc-row-hint">{[viewingNumber(r.number), `${r.site.name}, ${day(r.viewedOn)} at ${r.viewedAt}`, `checked by ${r.checkedBy}`,
                    r.incidentNumber ? incidentLabel(r.incidentNumber) : null, r.notes ? plural(r.notes, "note") : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={reasonMeta(r.reason)} />
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
