import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";

export type SegmentedLink = { href: string; label: React.ReactNode; count?: React.ReactNode; current: boolean };

/** Views of one list, as a soft bar of links (DESIGN.md, "Poolside Clear v2": every menu is one
 *  bar, 44px tall, the current view white with an edge). For page-to-page navigation inside a
 *  page (All / Active / Inactive, Upcoming / Past). Counts sit beside each label. The bar wraps
 *  onto more rows instead of scrolling. The current view is aria-current="true": the frame's
 *  page bar is the one place that marks the page itself. */
export function SegmentedLinks({ label, items, className }: { label: string; items: SegmentedLink[]; className?: string }) {
  return (
    <nav aria-label={label} className={`pc-seg${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="pc-seg-item" aria-current={item.current ? "true" : undefined}>
          {item.label}{item.count !== undefined ? <span className="pc-seg-count tabular-nums">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export type SegmentedOption = { value: string; label: React.ReactNode; icon?: LucideIcon; count?: React.ReactNode };

/** Exactly one of a few choices, as the same soft bar (radios: arrow keys move, the chosen one is
 *  white with an edge, no check mark). For client-state switches and form choices; put it in a
 *  form with `name` to post the value. `fill` stretches the bar and shares its width equally
 *  ("phone": only below 640px). An option may carry a permanent leading icon. */
export function SegmentedChoice({ options, fill, className, ...props }: {
  options: SegmentedOption[];
  fill?: boolean | "phone";
  className?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const fillClass = fill === "phone" ? " pc-seg-fill-phone" : fill ? " pc-seg-fill" : "";
  return (
    <RadioGroup orientation="horizontal" className={`pc-seg${fillClass}${className ? ` ${className}` : ""}`} {...props}>
      {options.map(({ value, label, icon: Icon, count }) => (
        <RadioGroupItem key={value} value={value} className="pc-seg-item">
          {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
          {label}
          {count !== undefined ? <span className="pc-seg-count tabular-nums">{count}</span> : null}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
