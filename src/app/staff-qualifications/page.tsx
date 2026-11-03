import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { REQUIREMENT_META } from "@/lib/people/requirements";
import { formatDate, nameInitials, toDateOnlyString, today } from "@/lib/format";
import { AssignRenewal, expiringQualifications, EXPIRY_WARNING_DAYS } from "@/modules/qualifications/features/expiring";

export const metadata: Metadata = { title: "Expiring qualifications" };

/** Qualifications that have expired or expire within the warning window, for
 *  the people this person covers, with the course that renews each. A newer
 *  certificate of the same type takes a person off the list. Filtered by site
 *  and position; below it, who has never held one their position needs. */
export default async function ExpiringPage({ searchParams }: { searchParams: Promise<{ site?: string; position?: string }> }) {
  const input = await searchParams;
  const { rows, missing, sites, positions } = await expiringQualifications({ site: input.site || undefined, position: input.position || undefined });
  const filtered = !!(input.site || input.position);
  const on = today();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Expiring qualifications" description={`Expired, or expiring in the next ${EXPIRY_WARNING_DAYS} days. Assign the course that renews it, or check the new certificate when it comes in.`} />}>
      <form method="get" className="flex flex-wrap items-end gap-4" role="search" aria-label="Filter expiring qualifications">
        <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:basis-auto sm:min-w-52"><Label htmlFor="expiring-site" className="block">Site</Label>
          <NativeSelect id="expiring-site" name="site" defaultValue={input.site ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Every site</NativeSelectOption>
            {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:basis-auto sm:min-w-52"><Label htmlFor="expiring-position" className="block">Position</Label>
          <NativeSelect id="expiring-position" name="position" defaultValue={input.position ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Every position</NativeSelectOption>
            {positions.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="min-h-11">Apply filters</Button>
          {filtered ? <Button asChild variant="ghost" className="min-h-11"><Link href="/staff-qualifications">Reset</Link></Button> : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState as="h2" icon="hourglass" title="Nothing expiring" hint={filtered ? `No one here expires in the next ${EXPIRY_WARNING_DAYS} days.` : `Everyone you cover is in date for the next ${EXPIRY_WARNING_DAYS} days.`} />
      ) : (
        <RecordSection id="expiring-heading" title="Expired or expiring" aside={<p>{rows.length}</p>}>
          <ul className="pc-list">
            {rows.map((row) => (
              <li key={row.id} className="pc-row">
                <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.name)}</AvatarFallback></Avatar>
                <div className="pc-row-body">
                  <span className="pc-row-title">{row.name}</span>
                  <p className="pc-row-hint">
                    {[
                      row.qualification,
                      row.jobTitle,
                      row.expiresOn ? `${row.state === "expired" ? "Expired" : "Expires"} ${formatDate(row.expiresOn)}` : null,
                      row.renewal ? `renewed by ${row.renewal.title}` : "no course renews it yet; record the new certificate once they have it",
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="pc-row-trail">
                  <Tag meta={QUALIFICATION_STATE_META[row.state]} />
                  {row.renewal?.assigned ? <span className="text-xs text-ui-muted-foreground">Course assigned</span>
                    : row.renewal?.canAssign ? <AssignRenewal courseId={row.renewal.courseId} title={row.renewal.title} userId={row.userId} name={row.name} expiresOn={row.expiresOn ? toDateOnlyString(row.expiresOn) : null} today={on} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </RecordSection>
      )}

      {missing.length ? (
        <RecordSection id="missing-heading" title="Missing for their position" aside={<p>{missing.length}</p>} note="Never recorded, though their position needs it. Check their certificate when they upload it, or record it on their staff record.">
          <ul className="pc-list">
            {missing.map((row) => (
              <li key={row.userId} className="pc-row">
                <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.name)}</AvatarFallback></Avatar>
                <div className="pc-row-body">
                  <span className="pc-row-title">{row.name}</span>
                  <p className="pc-row-hint">{row.position} · needs {row.lacking.join(", ")}</p>
                </div>
                <div className="pc-row-trail"><Tag meta={REQUIREMENT_META.missing} /></div>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}
    </PageShell>
  );
}
