import { Token } from "@/components/workspace/misc";


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
