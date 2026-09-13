import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
export function LinkPagination({
  label,
  page,
  totalItems,
  pageSize,
  pathname,
  query,
}: {
  label: string;
  page: number;
  totalItems: number;
  pageSize: number;
  pathname: string;
  query: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  function href(next: number) {
    const params = new URLSearchParams(query);
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    return params.size ? `${pathname}?${params}` : pathname;
  }
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Button variant="outline" asChild>
          <Link href={href(page - 1)}>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
      )}
      <span className="text-sm text-ui-muted-foreground tabular-nums">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Button variant="outline" asChild>
          <Link href={href(page + 1)}>
            Next
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}
