import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";

/** The stat sentence, not a row of tiles: counts read as prose, in Astryx's
 *  secondary text, with the numbers in primary ink. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <Text as="p" display="block" color="secondary" className="max-w-prose">
      {children}
    </Text>
  );
}

/** A number inside a sentence. */
export function Num({ children }: { children: React.ReactNode }) {
  return (
    <Text weight="medium" color="primary" hasTabularNumbers>
      {children}
    </Text>
  );
}

/** A number that wants noticing — attendance still to take, swimmers gone
 *  quiet. A badge rather than coloured text, which is what Astryx has for a
 *  count that carries a status. */
export function Alert({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "error";
}) {
  return <Badge variant={tone} label={children} />;
}
