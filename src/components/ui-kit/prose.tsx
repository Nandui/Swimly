import { Badge } from "@astryxdesign/core/Badge";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

/** The stat sentence, not a row of tiles: counts read as prose, in Astryx's
 *  secondary text, with the numbers in primary ink. Capped at a readable
 *  line, the way Astryx caps prose. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <VStack maxWidth="65ch">
      <Text as="p" display="block" color="secondary">
        {children}
      </Text>
    </VStack>
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

/** A count that wants noticing — attendance still to take, swimmers gone
 *  quiet. A Badge is what Astryx has for a count that carries a status. */
export function Alert({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "error";
}) {
  return <Badge variant={tone} label={children} />;
}
