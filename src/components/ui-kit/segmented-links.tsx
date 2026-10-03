import Link from "next/link";

export type SegmentedLink = { href: string; label: React.ReactNode; count?: React.ReactNode; current: boolean };

/** Views of one list, as a soft bar of links (DESIGN.md, "Poolside Clear v2": every menu is one
 *  bar, 44px tall, the current view white with an edge). For page-to-page navigation inside a
 *  page (All / Active / Inactive, Upcoming / Past). Counts sit beside each label. */
export function SegmentedLinks({ label, items, className }: { label: string; items: SegmentedLink[]; className?: string }) {
  return (
    <nav aria-label={label} className={`pc-seg${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="pc-seg-item" aria-current={item.current ? "page" : undefined}>
          {item.label}{item.count !== undefined ? <span className="pc-seg-count tabular-nums">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
