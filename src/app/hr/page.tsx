import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { ReviewStatusTag } from "@/components/hr/status";
import { hrPeople } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "HR" };

export default async function HrPeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireFreshSession("hr.records.read", "/hr");
  const { q = "" } = await searchParams;
  const { people } = await hrPeople(q);
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>HR</h1>
          <p className="text-sm">The people your HR role covers. Opening a record is logged.</p>
        </div>
      </div>
      <form method="get" className="module-filters flex flex-wrap items-end gap-3" role="search" aria-label="Find a person">
        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="hr-q">Person</Label><Input id="hr-q" name="q" defaultValue={q} placeholder="Name" className="min-h-11" /></div>
        <Button type="submit" className="min-h-11"><Search aria-hidden="true" />Find</Button>
      </form>
      <div className="module-results space-y-3">
        <p className="text-sm">{people.length} {people.length === 1 ? "person" : "people"}</p>
        {people.length === 0 ? (
          <div className="module-empty"><Users aria-hidden="true" /><h2 className="font-semibold">Nobody to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Nobody your role covers matches.</p></div>
        ) : (
          <ul className="module-list">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/hr/people/${p.id}`} className="module-row flex min-h-16 flex-wrap items-center justify-between gap-4 p-4 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="module-row-title">{p.name}</p>
                    <p className="text-sm text-ui-muted-foreground">{p.jobTitle || "No job title"}{p.latestReview ? ` · latest review: ${p.latestReview.period}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">{p.latestReview ? <ReviewStatusTag status={p.latestReview.status} /> : null}<ArrowRight className="module-row-arrow size-5" aria-hidden="true" /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
