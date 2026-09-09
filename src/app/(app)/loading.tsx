import { Skeleton } from "@/components/workspace/layout";
import { HStack, StackItem, VStack } from "@/components/workspace/layout";
import { VisuallyHidden } from "@/components/workspace/layout";

/** What every page shows for the moment between a click and its data.
 *
 *  Without this, nothing paints until the slowest query on the destination
 *  page has answered — the shell, the title, all of it waits. This file makes
 *  Next wrap each page in a Suspense boundary, so the sidebar and this
 *  placeholder arrive at once and the real page streams in behind them. It is
 *  the cheapest "feels faster" the app can have, because it costs no query.
 *
 *  Shaped like every page: a title, a description line, a sentence, rows. No
 *  spinner — a spinner says "wait", a page-shaped placeholder says "here it
 *  comes". */
export default function Loading() {
  return (
    <VStack gap={6} role="status" aria-busy="true" aria-live="polite">
      <VisuallyHidden>Loading</VisuallyHidden>

      <VStack gap={2}>
        <Skeleton width={176} height={28} index={0} />
        <Skeleton width="min(20rem, 100%)" height={16} index={1} />
      </VStack>

      <Skeleton width="min(28rem, 100%)" height={16} index={2} />

      <VStack gap={3}>
        {Array.from({ length: 6 }, (_, i) => (
          <HStack key={i} gap={4} vAlign="center">
            <Skeleton width={160} height={16} index={3 + i} />
            <Skeleton width={96} height={12} index={3 + i} className="max-md:hidden" />
            <StackItem className="ml-auto">
              <Skeleton width={64} height={12} index={3 + i} />
            </StackItem>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
