import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";

/** The one way back to a parent page: the themed ghost pill (blue text, soft
 *  blue hover, 44px) with a left chevron and the parent's name, set flush with
 *  the page edge above the H1. PageHeader renders it through its `back` prop;
 *  use it directly only where a page has no PageHeader. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="ghost" className="-ml-3 min-h-11 self-start">
      <Link href={href}>
        <ChevronLeft aria-hidden="true" />
        <span className="sr-only">Back to </span>
        {label}
      </Link>
    </Button>
  );
}
