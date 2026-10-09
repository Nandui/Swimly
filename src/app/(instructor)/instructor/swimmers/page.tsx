import type { Metadata } from "next";
import { HeartPulse, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { SearchField } from "@/components/ui-kit/search-field";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ageLabel, DAY_META, findSiteSwimmers, formatTime, MEDICAL_STATUS_META } from "@/modules/activities/features/instructor";
import { screenPage } from "@/lib/page-guards";
import { nameInitials, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Swimmers" };

/** Find a swimmer at this site from the pool deck. Tablet-sized; no desk
 *  profile links; medical notes only for swimmers you teach. */
export default async function DeckSwimmersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await screenPage("instructor", "attendance.mark");
  const { q = "" } = await searchParams;
  const results = await findSiteSwimmers(q);
  const query = q.trim();
  return (
    <>
      <PageHeader
        title="Swimmers at this site"
        description="Find a swimmer by name to see their level and class. Medical notes show for swimmers in classes you teach or are covering today"
      />
      <section className="pc-panel" aria-label="Find a swimmer">
        {/* An exact lookup by name (DeckSwimmers), so it keeps its visible Find button. */}
        <form className="flex flex-wrap items-end gap-3" role="search" action="/instructor/swimmers">
          <SearchField id="deck-swimmer-search" label="Find a swimmer" defaultValue={q} placeholder="First or last name" className="max-w-md flex-1 basis-64" />
          <Button type="submit"><Search aria-hidden="true" />Find</Button>
        </form>
        {query.length < 2 ? (
          <EmptyState compact icon="userSearch" title="Type at least two letters of a name" />
        ) : results.length === 0 ? (
          <EmptyState compact icon="searchX" title={`No swimmer matches “${query}”`} hint="Only swimmers with a current place at this site are listed." />
        ) : (
          <>
            <p className="pc-row-hint">{plural(results.length, "swimmer")} {results.length === 1 ? "matches" : "match"} “{query}”</p>
            <ul className="pc-rows" aria-label="Matching swimmers">
              {results.map((s) => (
                <li key={s.id} className="pc-row">
                  <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(s.name)}</AvatarFallback></Avatar>
                  <div className="pc-row-body">
                    <p className="pc-row-title break-words">{s.name}</p>
                    <p className="pc-row-hint break-words">
                      {[
                        s.dateOfBirth ? `Age ${ageLabel(s.dateOfBirth)}` : "Age not recorded",
                        ...s.places.map((p) => [p.level, `${DAY_META[p.dayOfWeek].label} ${formatTime(p.startMinutes)}`, p.name].filter(Boolean).join(" · ")),
                      ].join(" · ")}
                    </p>
                  </div>
                  {s.hasMedicalNotes && !s.medicalNotes ? <div className="pc-row-trail"><Tag meta={MEDICAL_STATUS_META.notes} /></div> : null}
                  {s.medicalNotes ? (
                    <p className="pc-note basis-full whitespace-pre-wrap">
                      <HeartPulse aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span><span className="font-semibold">Medical notes: </span>{s.medicalNotes}</span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
