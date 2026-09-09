"use client";

import { useRouter } from "next/navigation";
import { Pagination } from "@/components/workspace/misc";

/** Pages that live in the URL: the page number is a query parameter, so a
 *  page can be bookmarked or sent on, and the back button steps back through
 *  them. */
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
  /** The other parameters to carry along — the search, the filter. */
  query: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <Pagination
      label={label}
      page={page}
      totalItems={totalItems}
      pageSize={pageSize}
      variant="count"
      size="sm"
      onChange={(next) => {
        const params = new URLSearchParams(query);
        if (next > 1) params.set("page", String(next));
        else params.delete("page");
        const search = params.toString();
        router.push(search ? `${pathname}?${search}` : pathname);
      }}
    />
  );
}
