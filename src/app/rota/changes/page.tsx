import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRotaActor } from "@/lib/rota/access";
import { ROSTER_CHANGE_META } from "@/lib/rota/constants";
import { rotaChanges } from "@/lib/rota/data";

export const metadata: Metadata = { title: "Roster changes" };

const day = (date: Date) => formatDate(new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`));

/** Every roster upload, and for a re-upload what moved: who, which day, the
 *  entries before and after. */
export default async function RotaChangesPage({ searchParams }: { searchParams: Promise<{ upload?: string }> }) {
  const who = await requireRotaActor();
  if (!who.manage) notFound();
  const { imports, selected, changes } = await rotaChanges((await searchParams).upload);
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Roster changes</h1>
          <p className="text-sm">Each upload of the weekly roster. When a week is uploaded again, what changed for each person is listed here.</p>
        </div>
      </div>
      {imports.length === 0 ? (
        <div className="module-empty"><History aria-hidden="true" /><h2 className="font-semibold">No uploads yet</h2><p className="mt-2 text-sm text-ui-muted-foreground"><Link href="/rota/import" className="underline underline-offset-2">Upload the week&apos;s roster</Link> to start.</p></div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Uploads" className="module-panel p-2">
            <ul className="flex flex-col">
              {imports.map((i) => (
                <li key={i.id}>
                  <Link href={`/rota/changes?upload=${i.id}`} aria-current={i.id === selected?.id ? "page" : undefined}
                    className="flex min-h-11 flex-col gap-0.5 rounded-ui-md px-3 py-2 hover:bg-ui-accent aria-[current=page]:bg-ui-accent">
                    <span className="text-sm font-semibold">Week of {day(i.weekStart)}</span>
                    <span className="text-xs text-ui-muted-foreground">{formatDateTime(i.createdAt)} · {i.importedByName}</span>
                    <span className="text-xs text-ui-muted-foreground">{i.added + i.changed + i.removed ? `${i.added} added · ${i.changed} changed · ${i.removed} removed` : `${i.people} people · ${i.shifts} shifts`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {selected ? (
            <section className="module-panel" aria-labelledby="changes-title">
              <h2 id="changes-title">Week of {day(selected.weekStart)}</h2>
              <p className="mt-1 text-sm text-ui-muted-foreground">{selected.fileName}, uploaded {formatDateTime(selected.createdAt)} by {selected.importedByName}. {selected.people} people, {selected.shifts} shifts, {selected.holidays} full holiday {selected.holidays === 1 ? "day" : "days"}.</p>
              {changes.length === 0 ? (
                <p className="mt-4 text-sm text-ui-muted-foreground">{selected.added + selected.changed + selected.removed === 0 ? "The first upload of this week, or nothing changed since the last one." : "No changes recorded."}</p>
              ) : (
                <ul className="mt-4 divide-y divide-ui-border">
                  {changes.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                      <div className="min-w-0 basis-48">
                        <p className="text-sm font-semibold">{c.personName}</p>
                        <p className="text-xs text-ui-muted-foreground">{day(c.date)} · No. {c.employeeNo}</p>
                      </div>
                      <Tag color={ROSTER_CHANGE_META[c.kind as keyof typeof ROSTER_CHANGE_META]?.color ?? "gray"}>{ROSTER_CHANGE_META[c.kind as keyof typeof ROSTER_CHANGE_META]?.label ?? c.kind}</Tag>
                      <p className="min-w-0 flex-1 text-sm">
                        {c.before ? <span className="text-ui-muted-foreground line-through decoration-1">{c.before}</span> : null}
                        {c.before && c.after ? " → " : null}
                        {c.after ? <span>{c.after}</span> : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
