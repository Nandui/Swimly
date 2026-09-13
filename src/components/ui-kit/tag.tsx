import { Badge } from "@/components/shadcn/badge";

/** Domain metadata selects the semantic tone; the badge supplies its styling. */
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
    <Badge variant="secondary" data-tone={color} className={className}>
      {children}
    </Badge>
  );
}
