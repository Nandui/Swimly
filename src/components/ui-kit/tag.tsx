import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";

/** The nine colours a status may wear. Every status in the app maps onto one
 *  of these through a metadata map in the `constants.ts` of its domain under
 *  `src/lib`; no call site picks a colour. The names are the app's, the drawing is Astryx's Badge. */
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

/** Astryx has no brown; teal stands in and reads as its own hue. Gray is the
 *  neutral badge. */
const VARIANT: Record<TagColor, BadgeVariant> = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  blue: "blue",
  purple: "purple",
  pink: "pink",
  brown: "teal",
  gray: "neutral",
};

export function Tag({
  color = "gray",
  className,
  children,
}: {
  color?: TagColor;
  className?: string;
  children: React.ReactNode;
}) {
  return <Badge variant={VARIANT[color]} label={children} className={className} />;
}
