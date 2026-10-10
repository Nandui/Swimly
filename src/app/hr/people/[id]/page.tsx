import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { Award, CalendarClock, CalendarDays, ChevronRight, Download, FileText, GraduationCap, UserX, type LucideIcon } from "lucide-react";
import { EditEmployment, EditProfile, RecordQualification, RevokeQualification } from "@/components/people/people-actions";
import { CONTRACT_META, QUALIFICATION_STATE_META, hoursOf, type ContractType } from "@/lib/people/constants";
import { qualificationFile } from "@/lib/people/qualifications";
import { REQUIREMENT_META, requirementSummary } from "@/lib/people/requirements";
import { Button } from "@/components/shadcn/button";
import { AddNote, hrConfigured, hrPerson, NOTE_VISIBILITY_META, REVIEW_STATUS_META, WithdrawNote } from "@/modules/hr/features/person";
import { StartReview } from "@/modules/hr/features/reviews";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireFreshSession } from "@/lib/policy/session";
import { AuthorizationError } from "@/lib/authz";

/** The tile icon for each module's section of the person's file, by its stable key. */
const FILE_ICONS: Record<string, LucideIcon> = { "rota.planned": CalendarDays, "rota.absences": UserX, "rota.changes": CalendarClock, "training.open": GraduationCap };

/** One read (and one access log row) per request, shared by the page and its tab title. */
const load = cache(hrPerson);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Switched off: the layout shows a notice in place of the page.
  if (!hrConfigured()) return { title: "HR" };
  try {
    await requireFreshSession("hr.records.read", `/hr/people/${id}`);
    return { title: (await load(id)).person.name };
  } catch (error) {
    // No HR access: the layout turns the page into a 404, so the title is the 404 page's.
    if (error instanceof AuthorizationError) return { title: "Page not found" };
    throw error;
  }
}

export default async function HrPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireFreshSession("hr.records.read", `/hr/people/${id}`);
  const data = await load(id);
  const { person, details: d, notes, reviews, who, options } = data;
  const day = (value: string) => formatDate(new Date(`${value}T00:00:00Z`));
  const personLink = (p: { id: string; name: string }) => <Link className="-my-3 inline-flex min-h-11 items-center underline underline-offset-4" href={`/hr/people/${p.id}`}>{p.name}</Link>;
  const quals = await qualificationFile(person.id, who.orgId ?? "");
  return (
    <>
      <PageHeader
        back={{ href: "/hr", label: "People" }}
        title={person.name}
        description={person.jobTitle || "HR record"}
        actions={
          <>
            {who.superadmin ? <Button asChild variant="ghost" className="min-h-11"><a href={`/hr/people/${person.id}/export`}><Download aria-hidden="true" />Export everything</a></Button> : null}
            {data.canWriteReviews ? <StartReview subjectUserId={person.id} name={person.name} /> : null}
            {data.canWriteNotes ? <AddNote subjectUserId={person.id} name={person.name} /> : null}
          </>
        }
      />
      <section className="pc-panel" aria-labelledby="hr-profile">
        <div className="pc-panel-head">
          <h2 id="hr-profile">Profile</h2>
          {options ? <EditProfile person={{ ...d, id: person.id, name: person.name }} sites={options.sites} departments={options.departments} people={options.people} positions={options.positions} /> : null}
        </div>
        <Facts items={[
          ["Position", d.position ? `${d.position.name}${d.position.archivedAt ? " (archived)" : ""}` : d.jobTitle ? `${d.jobTitle} (not on the list)` : "Not set"],
          ["Started", d.startedOn ? day(d.startedOn) : "Not set"],
          ["Date of birth", d.dateOfBirth ? day(d.dateOfBirth) : "Not set"],
          ["Main site", d.primaryClub ?? "Not set"],
          ["Manager", d.manager ? personLink(d.manager) : "No manager"],
          ["Departments", d.departments.length ? d.departments.map((x) => x.department.name + (x.isPrimary && d.departments.length > 1 ? " (main)" : "")).join(", ") : "None"],
        ]} />
        {d.reports.length ? (
          <p className="text-sm text-ui-muted-foreground">Manages {d.reports.map((r, i) => <span key={r.id}>{i ? ", " : ""}{personLink(r)}</span>)}</p>
        ) : null}
      </section>
      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="hr-employment">
          <div className="pc-panel-head">
            <h2 id="hr-employment">Employment</h2>
            {options ? <EditEmployment person={{ ...d, id: person.id, name: person.name }} /> : null}
          </div>
          <Facts items={[
            ["Contract", d.contractType ? CONTRACT_META[d.contractType as ContractType]?.label ?? d.contractType : "Not set"],
            ["Hours a week", d.contractMinutes != null ? hoursOf(d.contractMinutes) : "Not set"],
            ["Payroll number", d.payrollNumber || "Not set"],
            ["Last day", d.endedOn ? day(d.endedOn) : "Still here"],
          ]} />
        </section>
        <section className="pc-panel" aria-labelledby="hr-contact">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1"><h2 id="hr-contact">Contact</h2><p className="pc-row-hint">Kept by them in Turnfin Me; their changes come to Details changes.</p></div>
          </div>
          <Facts items={[
            ["Phone", d.phone || "Not given"],
            ["Home address", d.homeAddress || "Not given"],
            ["Emergency contact", d.emergencyName ? [d.emergencyName, d.emergencyRelationship, d.emergencyPhone].filter(Boolean).join(" · ") : "Not given"],
          ]} />
        </section>
      </div>
      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="hr-notes">
          <div className="pc-panel-head"><h2 id="hr-notes">Notes</h2></div>
          {notes.length === 0 ? <EmptyState compact icon="scrollText" title="No notes you can read" /> : (
            <ul className="pc-rows">
              {notes.map((n) => (
                <li key={n.id} className="pc-row">
                  {/* A note is prose: it keeps a readable width, and the tag and Withdraw wrap under it. */}
                  <div className="pc-row-body min-w-[min(100%,var(--pc-field-min))]!">
                    <span className="pc-row-title">{n.authorName} · {formatDateTime(new Date(n.createdAt))}</span>
                    <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                  </div>
                  <div className="pc-row-trail">
                    <Tag meta={NOTE_VISIBILITY_META[n.visibility]} />
                    {data.canWriteNotes && (n.authorId === who.id || who.superadmin) ? <WithdrawNote id={n.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="hr-reviews">
          <div className="pc-panel-head"><h2 id="hr-reviews">Performance reviews</h2></div>
          {reviews.length === 0 ? <EmptyState compact icon="clipboardList" title="No reviews yet" /> : (
            <ul className="pc-rows">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link href={`/hr/reviews/${r.id}`} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{r.period}</span>
                      <span className="pc-row-hint">{r.reviewerName} · {r.sharedAt ? `shared ${formatDate(new Date(r.sharedAt))}` : `started ${formatDate(new Date(r.createdAt))}`}</span>
                    </span>
                    <span className="pc-row-trail">
                      <Tag meta={REVIEW_STATUS_META[r.status]} />
                      <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="pc-panel" aria-labelledby="hr-qualifications">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1">
            <h2 id="hr-qualifications">Qualifications</h2>
            <p className="pc-row-hint">{quals.position ? `${quals.position}: ${requirementSummary(quals.requirements)}.` : "No position set: their profile sets it, and it decides what they need."}</p>
          </div>
          {quals.canRecord && quals.types.length ? <RecordQualification userId={person.id} name={person.name} types={quals.types} /> : null}
        </div>
        {quals.requirements.length ? (
          <ul className="pc-rows" aria-label="What their position needs">
            {quals.requirements.map((r) => (
              <li key={r.typeId} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true"><Award /></span>
                <span className="pc-row-body"><span className="pc-row-title">{r.name}</span><span className="pc-row-hint">{r.expiresOn ? `Expires ${formatDate(new Date(`${r.expiresOn}T00:00:00Z`))}` : r.state === "missing" ? "Needed for their position" : "Does not expire"}</span></span>
                <span className="pc-row-trail"><Tag meta={REQUIREMENT_META[r.state]} /></span>
              </li>
            ))}
          </ul>
        ) : null}
        {quals.records.length === 0 ? <EmptyState compact icon="award" title="No qualifications recorded" /> : (
          <ul className="pc-rows" aria-label="Every qualification recorded">
            {quals.records.map((q) => (
              <li key={q.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{q.name}</span>
                  <span className="pc-row-hint">{[q.issuedOn ? `Issued ${formatDate(new Date(`${q.issuedOn}T00:00:00Z`))}` : null, q.expiresOn ? `expires ${formatDate(new Date(`${q.expiresOn}T00:00:00Z`))}` : "does not expire", q.reference || null, q.verifiedBy ? `verified by ${q.verifiedBy}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={QUALIFICATION_STATE_META[q.state]} />
                  {q.certificateId ? <Button asChild variant="ghost"><a href={`/training/certificates/${q.certificateId}/file`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Certificate</a></Button> : null}
                  {quals.canRecord && q.state !== "revoked" ? <RevokeQualification id={q.id} label={q.name} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {data.file.map((section) => {
        const Icon = FILE_ICONS[section.id] ?? FileText;
        return (
        <section key={section.id} className="pc-panel" aria-labelledby={`file-${section.id}`}>
          <div className="pc-panel-head"><h2 id={`file-${section.id}`}>{section.heading}</h2></div>
          <p className="text-sm text-ui-muted-foreground">{section.summary}</p>
          {section.entries.length ? (
            <ul className="pc-rows">
              {section.entries.map((e) => (
                <li key={e.id} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <div className="pc-row-body">
                    <span className="pc-row-title">{e.title}</span>
                    <span className="pc-row-hint">{e.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        );
      })}
    </>
  );
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,var(--pc-tile-min)),1fr))]">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
          <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
