import type { Metadata } from "next";
import { HeartPulse, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { SearchField } from "@/components/ui-kit/search-field";
import { Item, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { Tag } from "@/components/ui-kit/tag";
import { DAY_META, formatTime } from "@/modules/activities/lib/courses/constants";
import { findSiteSwimmers } from "@/modules/activities/lib/instructor/swimmers";
import { screenPage } from "@/lib/page-guards";
import { MEDICAL_STATUS_META, ageLabel } from "@/modules/activities/lib/students/constants";

export const metadata: Metadata = { title: "Swimmers" };

/** Find a swimmer at this site from the pool deck. Tablet-sized; no desk
 *  profile links; medical notes only for swimmers you teach. */
export default async function DeckSwimmersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await screenPage("instructor", "attendance.mark");
  const { q = "" } = await searchParams;
  const results = await findSiteSwimmers(q);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Swimmers at this site</h1>
        <p className="text-sm text-ui-muted-foreground">Find a swimmer by name to see their level and class. Medical notes show for swimmers in classes you teach or are covering today.</p>
      </div>
      {/* An exact lookup by name (DeckSwimmers), so it keeps its visible Find button. */}
      <form className="flex flex-wrap items-end gap-2" role="search" action="/instructor/swimmers">
        <SearchField id="deck-swimmer-search" label="Find a swimmer" defaultValue={q} placeholder="First or last name" className="max-w-md flex-1 basis-64" />
        <Button type="submit"><Search aria-hidden="true" />Find</Button>
      </form>
      {q.trim().length < 2 ? (
        <p className="text-sm text-ui-muted-foreground">Type at least two letters of a name.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-ui-muted-foreground">No swimmer with a current place at this site matches “{q}”.</p>
      ) : (
        <ItemGroup className="divide-y divide-ui-border" aria-label="Matching swimmers">
          {results.map((s) => (
            <Item key={s.id} role="listitem" className="items-start">
              <ItemContent className="min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{s.name}</span>
                  {s.hasMedicalNotes && !s.medicalNotes ? <Tag meta={MEDICAL_STATUS_META.notes} /> : null}
                </div>
                <span className="text-sm text-ui-muted-foreground">{s.dateOfBirth ? `Age ${ageLabel(s.dateOfBirth)}` : "Age not recorded"}</span>
                {s.places.map((p) => (
                  <span key={p.courseId} className="text-sm">{p.level} · {DAY_META[p.dayOfWeek].label} {formatTime(p.startMinutes)}{p.name ? ` · ${p.name}` : ""}</span>
                ))}
                {s.medicalNotes ? (
                  <p className="mt-1 flex gap-2 whitespace-pre-wrap text-sm"><HeartPulse aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span><span className="font-semibold">Medical notes: </span>{s.medicalNotes}</span></p>
                ) : null}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
