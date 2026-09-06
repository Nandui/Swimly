import { ChevronLeft } from "lucide-react";
import { Link } from "@astryxdesign/core/Link";
import { HStack } from "@astryxdesign/core/Stack";

/** The way back up, above a page's title: one quiet link naming where it
 *  goes. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} color="secondary" isStandalone>
      <HStack gap={1} vAlign="center" as="span">
        <ChevronLeft className="size-4" aria-hidden />
        {children}
      </HStack>
    </Link>
  );
}
