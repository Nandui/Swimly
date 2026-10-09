import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime, nameInitials, plural } from "@/lib/format";
import { REVIEW_STATUS_META } from "@/modules/hr/lib/constants";
import { hrPeople } from "@/modules/hr/lib/records";
import { STEP_UP_MS } from "@/lib/policy/engine";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "HR" };

export default async function HrPeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireFreshSession("hr.records.read", "/hr");
  const { q = "" } = await searchParams;
  const { people } = await hrPeople(q);
  // Dev sign-ins pass the step-up without a password time, so they get no time sentence.
  const confirmedAt = actor.authMethod === "password" && actor.authAt ? formatDateTime(new Date(actor.authAt)) : null;
  return (
    <>
      <PageHeader title="HR" description="The people your HR role covers. Opening a record is logged." />
      <div className="pc-note">
        <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-primary" />
        <p className="text-sm">
          Restricted · every read is logged.
          {confirmedAt ? ` You confirmed your password at ${confirmedAt}; it lasts ${STEP_UP_MS / 60000} minutes.` : null}
        </p>
      </div>
      <section className="pc-panel" aria-label="People">
        <form method="get" role="search" aria-label="Find a person">
          <SearchField label="Person" placeholder="Name" name="q" defaultValue={q} clearHref={q ? "/hr" : undefined} />
        </form>
        {people.length > 0 ? <p className="text-xs text-ui-muted-foreground">{plural(people.length, "person", "people")}</p> : null}
        {people.length === 0 ? (
          <EmptyState as="h2" role="status" icon="users" title="Nobody to show" hint={q ? "Nobody your role covers matches that name." : "Your HR role covers nobody yet."} />
        ) : (
          <ul className="pc-rows">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/hr/people/${p.id}`} className="pc-row">
                  <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(p.name)}</AvatarFallback></Avatar>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{p.name}</span>
                    <span className="pc-row-hint">{p.jobTitle || "No job title"}{p.latestReview ? ` · latest review: ${p.latestReview.period}` : ""}</span>
                  </span>
                  <span className="pc-row-trail">
                    {p.latestReview ? <Tag meta={REVIEW_STATUS_META[p.latestReview.status]} /> : null}
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
