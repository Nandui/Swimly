import { Token } from "@astryxdesign/core/Token";

/** The nine colours a status may wear. Every status in the app maps onto one
 *  of these through a metadata map in the `constants.ts` of its domain under
 *  `src/lib`; no call site picks a colour. The names are the app's; the
 *  drawing is Astryx's Token, which is what Astryx has for a status or a
 *  category — a Badge is for counts. */
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

/** Astryx has no brown; teal stands in and reads as its own hue. */
const COLOR: Record<TagColor, "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "teal" | "gray"> = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  blue: "blue",
  purple: "purple",
  pink: "pink",
  brown: "teal",
  gray: "gray",
};

/** The words in a node: a Token's label is a string, and a few call sites
 *  build theirs from pieces — "5 of 8". */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

export function Tag({
  color = "gray",
  className,
  children,
}: {
  color?: TagColor;
  className?: string;
  children: React.ReactNode;
}) {
  return <Token size="sm" color={COLOR[color]} label={textOf(children)} className={className} />;
}
