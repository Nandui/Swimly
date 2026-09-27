import type { Metadata } from "next";
import { formatDateTime } from "@/lib/format";
import { hrActivity } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "Who read what" };

/** Superadmins only: the HR read log and change log, newest first. */
export default async function HrActivityPage() {
  await requireFreshSession("hr.records.read", "/hr/activity");
  const { reads, changes } = await hrActivity();
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Who read what</h1>
          <p className="text-sm">Every time someone opened an HR record, and every change. The last 100 of each.</p>
        </div>
      </div>
      <div className="module-columns">
        <section className="module-panel" aria-labelledby="hr-reads">
          <h2 id="hr-reads">Reads</h2>
          {reads.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody has opened an HR record yet.</p> : (
            <ul>{reads.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <p><span className="font-semibold">{r.actorName}</span> opened {r.purpose}</p>
                <p className="text-xs text-ui-muted-foreground">{formatDateTime(new Date(r.at))} · {r.subjects.length > 3 ? `${r.subjects.slice(0, 3).join(", ")} and ${r.subjects.length - 3} more` : r.subjects.join(", ")}</p>
              </li>
            ))}</ul>
          )}
        </section>
        <section className="module-panel" aria-labelledby="hr-changes">
          <h2 id="hr-changes">Changes</h2>
          {changes.length === 0 ? <p className="text-sm text-ui-muted-foreground">No changes yet.</p> : (
            <ul>{changes.map((c) => (
              <li key={c.id} className="space-y-1 py-3">
                <p><span className="font-semibold">{c.actorName}</span>: {c.summary}</p>
                <p className="text-xs text-ui-muted-foreground">{formatDateTime(new Date(c.at))}</p>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
