import Link from "next/link";
import { ChevronRight, FileUp, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Figure, Figures } from "@/components/ui-kit/figure";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, plural } from "@/lib/format";
import { RemoveNonSwimmers } from "@/modules/activities/features/failed-payments/components/remove-non-swimmers";
import type { paymentLists, View } from "@/modules/activities/features/failed-payments/server/data";
import { euro, monthLabel, PAYMENT_STATUS_META, type PaymentView } from "@/modules/activities/shared/payments/types";

type Data = Awaited<ReturnType<typeof paymentLists>>;
const LABEL: Record<View, string> = { to_contact: "To contact", contacted: "Contacted", closed: "Closed" };
const TITLE: Record<View, string> = { to_contact: "Nobody has contacted them yet", contacted: "Contacted, waiting on the member", closed: "Recovered or ended" };
const EMPTY: Record<View, { title: string; hint?: string }> = {
  to_contact: { title: "Nobody is waiting to be contacted", hint: "New failures arrive when the month’s sheet is uploaded." },
  contacted: { title: "Nobody is waiting on a reply" },
  closed: { title: "Nothing closed yet" },
};

/** A row's tile: orange while nobody has made contact, green once recovered. The tag says it in words. */
const tone = (r: PaymentView) => (r.status === "to_contact" ? "orange" : r.status === "paid" || r.status === "new_mandate" ? "green" : undefined);

function hint(r: PaymentView) {
  const contact = r.attempts ? `${plural(r.attempts, "contact")}${r.lastContactAt ? `, last ${formatDate(new Date(r.lastContactAt))}` : ""}` : null;
  return [r.memberNumber || null, r.siteName, monthLabel(r.month), r.returnReason || r.returnCode || null, contact].filter(Boolean).join(" · ");
}

/** The failed direct debits at the person's sites, one view at a time: those nobody has contacted
 *  yet first, then those waiting on the member, then the closed ones. Narrowed by site, month or a
 *  search; the filters are a plain form, so they work before the page's script loads. */
export function FailureList({ data }: { data: Data }) {
  const keep = { ...(data.site ? { site: data.site } : {}), ...(data.month ? { month: data.month } : {}), ...(data.q ? { q: data.q } : {}) };
  const href = (show: View) => `/payments?${new URLSearchParams({ show, ...keep })}`;
  const open = data.counts.to_contact + data.counts.contacted;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Failed payments"
        description="Direct debits that failed at your sites. Contact each member and record how it ended; the money itself is taken in Legend."
        actions={data.who.manage ? <>
          {data.nonSwimmers?.remove ? <RemoveNonSwimmers remove={data.nonSwimmers.remove} worked={data.nonSwimmers.worked} /> : null}
          <Button asChild><Link href="/payments/upload"><FileUp aria-hidden="true" />Upload the sheet</Link></Button>
        </> : null} />}>
      <Figures label="Failed payments at a glance">
        <Figure href={href("to_contact")} value={data.counts.to_contact} label="To contact" hint={data.counts.to_contact ? "Nobody has chased these yet" : "Everyone has been contacted"} tone={data.counts.to_contact ? "orange" : undefined} current={data.show === "to_contact"} />
        <Figure href={href("contacted")} value={data.counts.contacted} label="Waiting on the member" hint="Contacted, not recovered yet" current={data.show === "contacted"} />
        <Figure value={euro(data.owedCents)} quiet={data.owedCents === 0} label="Still to recover" hint={plural(open, "payment") + " open"} />
      </Figures>

      <form method="get" action="/payments" role="search" aria-label="Find failed payments" className="flex min-w-0 flex-wrap items-end gap-3">
        <input type="hidden" name="show" value={data.show} />
        <SearchField label="Name, member number or reference" name="q" defaultValue={data.q} placeholder="Murphy, LWC1234" className="grow basis-(--field-min)" />
        {data.sites.length > 1 ? (
          <Field label="Site" htmlFor="pay-site">
            <NativeSelect id="pay-site" name="site" defaultValue={data.site} className="min-h-11">
              <NativeSelectOption value="">All sites</NativeSelectOption>
              {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        ) : null}
        {data.months.length ? (
          <Field label="Month" htmlFor="pay-month">
            <NativeSelect id="pay-month" name="month" defaultValue={data.month} className="min-h-11">
              <NativeSelectOption value="">Every month</NativeSelectOption>
              {data.months.map((m) => <NativeSelectOption key={m.value} value={m.value}>{m.label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        ) : null}
        <Button type="submit" variant="outline" className="min-h-11"><Search aria-hidden="true" />Find</Button>
        {data.q || data.site || data.month ? <Button asChild variant="ghost" className="min-h-11"><Link href={`/payments?show=${data.show}`}>Clear</Link></Button> : null}
      </form>

      <SegmentedLinks label="Show payments" items={(["to_contact", "contacted", "closed"] as const).map((v) => ({ href: href(v), label: LABEL[v], count: data.counts[v], current: v === data.show }))} />

      <section aria-labelledby="pay-list-h" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="pay-list-h">{TITLE[data.show]}</h2>{data.counts[data.show] ? <p>{data.counts[data.show]}</p> : null}</div>
        {data.rows.length === 0 ? (
          <div className="pc-list">
            <EmptyState compact icon={data.q ? "searchX" : "clipboardCheck"} title={data.q ? `Nothing matches “${data.q}”` : EMPTY[data.show].title} hint={data.q ? "Try part of the name, or the member number." : EMPTY[data.show].hint} />
          </div>
        ) : (
          <ul className="pc-list">
            {data.rows.map((r) => {
              const Icon = PAYMENT_STATUS_META[r.status].icon;
              return (
                <li key={r.id}>
                  <Link href={`/payments/${r.id}`} className="pc-row">
                    <span className="pc-tile-icon" data-tone={tone(r)}><Icon aria-hidden="true" /></span>
                    <span className="pc-row-body">
                      <span className="pc-row-title break-words">{r.name}</span>
                      <span className="pc-row-hint tabular-nums">{hint(r)}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5"><Tag meta={PAYMENT_STATUS_META[r.status]} /></span>
                    </span>
                    <span className="pc-row-trail">
                      <span className="pc-row-value tabular-nums">{euro(r.amountCents)}</span>
                      <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <LinkPagination label="Payment pages" page={data.page} pageCount={data.pages} pathname="/payments" query={{ show: data.show, ...keep }} />
    </PageShell>
  );
}
