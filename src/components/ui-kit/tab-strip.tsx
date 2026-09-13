import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { cn } from "@/lib/utils";
export type TabStripItem = {
  key: string;
  href: string;
  label: string;
  count?: number | null;
  active: boolean;
};
/** URL sections stay ordinary links, preserving bookmarks and browser history. */
export function TabStrip({
  ariaLabel,
  items,
  countsOnPhone = false,
}: {
  ariaLabel: string;
  items: TabStripItem[];
  countsOnPhone?: boolean;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2 border-b border-ui-border"
    >
      {items.map((item) => (
        <Button
          key={item.key}
          asChild
          variant="ghost"
          className={cn(
            "min-h-11 rounded-none border-b-2 border-transparent",
            item.active && "border-ui-foreground",
          )}
        >
          <Link
            href={item.href}
            aria-current={item.active ? "page" : undefined}
          >
            {item.label}
            {item.count != null ? (
              <Badge
                variant="secondary"
                className={countsOnPhone ? undefined : "max-sm:hidden"}
              >
                {item.count}
              </Badge>
            ) : null}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
