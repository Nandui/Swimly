import { Badge } from "@/components/workspace/feedback";
import { VStack } from "@/components/workspace/layout";
import { Text } from "@/components/workspace/typography";


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


export function Alert({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "error";
}) {
  return <Badge variant={tone} label={children} />;
}
