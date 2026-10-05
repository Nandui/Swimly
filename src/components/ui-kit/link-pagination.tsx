import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { formatCount } from "@/lib/format";

/** The one pager: Previous on the left, a centred caption, Next on the right.
 *  It sits at the foot of the list panel and hides itself when there is only
 *  one page. The caption reads "26 to 50 of 1,102" when the total is known,
 *  else "Page 2 of 5". Server lists pass `pathname` and `query` and each
 *  button is a link that keeps the other search params; client-state lists
 *  pass `onPage` instead (no hooks here, so only a client component can). */
export function LinkPagination({
  label,
  page,
  pageCount,
  totalItems,
  pageSize,
  pathname = "",
  query = {},
  onPage,
}: {
  label: string;
  page: number;
  pageCount?: number;
  totalItems?: number;
  pageSize?: number;
  pathname?: string;
  query?: Record<string, string>;
  onPage?: (page: number) => void;
}) {
  const known = totalItems !== undefined && pageSize !== undefined;
  const pages = Math.max(
    1,
    known ? Math.ceil(totalItems / pageSize) : (pageCount ?? 1),
  );
  if (pages <= 1) return null;
  const caption = known
    ? `${formatCount(Math.min(totalItems, (page - 1) * pageSize + 1))} to ${formatCount(Math.min(totalItems, page * pageSize))} of ${formatCount(totalItems)}`
    : `Page ${formatCount(page)} of ${formatCount(pages)}`;
  function href(next: number) {
    const params = new URLSearchParams(query);
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    return params.size ? `${pathname}?${params}` : pathname;
  }
  function step(next: number, children: React.ReactNode) {
    const enabled = next >= 1 && next <= pages;
    if (!enabled)
      return (
        <Button type="button" variant="outline" className="min-h-11" disabled>
          {children}
        </Button>
      );
    if (onPage)
      return (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => onPage(next)}>
          {children}
        </Button>
      );
    return (
      <Button variant="outline" className="min-h-11" asChild>
        <Link href={href(next)}>{children}</Link>
      </Button>
    );
  }
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {step(
        page - 1,
        <>
          <ChevronLeft aria-hidden="true" />
          Previous
        </>,
      )}
      <span
        className="text-xs text-ui-muted-foreground tabular-nums"
        aria-live={onPage ? "polite" : undefined}
      >
        {caption}
      </span>
      {step(
        page + 1,
        <>
          Next
          <ChevronRight aria-hidden="true" />
        </>,
      )}
    </nav>
  );
}
