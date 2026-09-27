import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { Label } from "@/components/shadcn/label";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ReviewStatusTag } from "@/components/hr/status";
import { hrPeople } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: { absolute: "Turnfin HR" } };

export default async function HrPeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireFreshSession("hr.records.read", "/hr");
  const { q = "" } = await searchParams;
  const { people } = await hrPeople(q);
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title="HR and performance" description="The people your HR role covers. Opening a record is logged." />
      <form method="get" className="flex flex-wrap items-end gap-3" role="search" aria-label="Find a person">
        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="hr-q">Person</Label><Input id="hr-q" name="q" defaultValue={q} placeholder="Name" className="min-h-11" /></div>
        <Button type="submit" className="min-h-11"><Search aria-hidden="true" />Find</Button>
      </form>
      <section className="min-w-0 flex flex-col gap-3" aria-label="People">
        <p className="text-sm text-ui-muted-foreground">{people.length} {people.length === 1 ? "person" : "people"}</p>
        {people.length === 0 ? (
          <EmptyState icon="users" title="Nobody to show" hint="Nobody your role covers matches." />
        ) : (
          <ItemGroup className="divide-y divide-ui-border rounded-ui-lg border border-ui-border">
            {people.map((p) => (
              <Item key={p.id} asChild role="listitem" className="rounded-none">
                <Link href={`/hr/people/${p.id}`} prefetch={false} className="hover:bg-ui-muted/50">
                  <ItemContent className="min-w-0 gap-1">
                    <ItemTitle>{p.name}</ItemTitle>
                    <p className="text-sm text-ui-muted-foreground">{p.jobTitle || "No job title"}{p.latestReview ? ` · latest review: ${p.latestReview.period}` : ""}</p>
                  </ItemContent>
                  {p.latestReview ? <ReviewStatusTag status={p.latestReview.status} /> : null}
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
