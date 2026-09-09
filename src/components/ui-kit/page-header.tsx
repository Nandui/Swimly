import { HStack, StackItem, VStack } from "@/components/workspace/layout";
import { Heading, Text } from "@/components/workspace/typography";

/** The page's opening: one H1, a quiet description line, actions at the end.
 *  The actions wrap under the title on a phone rather than off the screen. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <HStack gap={4} wrap="wrap" vAlign="start" hAlign="between">
      <StackItem size="fill">
        <VStack gap={1}>
          <Heading level={1}>{title}</Heading>
          {description ? (
            <Text as="p" color="secondary" display="block" maxLines={0}>
              {description}
            </Text>
          ) : null}
        </VStack>
      </StackItem>
      {actions ? (
        <HStack gap={2} wrap="wrap" vAlign="center">
          {actions}
        </HStack>
      ) : null}
    </HStack>
  );
}
