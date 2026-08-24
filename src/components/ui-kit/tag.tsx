import { cn } from "@/lib/utils";

export type TagColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "gray";

const TAG_CLASSES: Record<TagColor, string> = {
  red: "bg-(--tag-red-bg) text-(--tag-red-fg)",
  orange: "bg-(--tag-orange-bg) text-(--tag-orange-fg)",
  yellow: "bg-(--tag-yellow-bg) text-(--tag-yellow-fg)",
  green: "bg-(--tag-green-bg) text-(--tag-green-fg)",
  blue: "bg-(--tag-blue-bg) text-(--tag-blue-fg)",
  purple: "bg-(--tag-purple-bg) text-(--tag-purple-fg)",
  pink: "bg-(--tag-pink-bg) text-(--tag-pink-fg)",
  brown: "bg-(--tag-brown-bg) text-(--tag-brown-fg)",
  gray: "bg-(--tag-gray-bg) text-(--tag-gray-fg)",
};

/** Notion-database-style soft tint tag. */
export function Tag({
  color = "gray",
  className,
  children,
}: {
  color?: TagColor;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-px text-xs font-medium leading-5 whitespace-nowrap",
        TAG_CLASSES[color],
        className
      )}
    >
      {children}
    </span>
  );
}
