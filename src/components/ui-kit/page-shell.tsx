import type { ReactElement, ReactNode } from "react";
import type { PageHeader } from "@/components/ui-kit/page-header";

/** Every page's body (owner rule, 20 October 2026: every page uses PageShell and PageHeader).
 *  The page's PageHeader first, with the page's one H1, then its blocks in one column 16px
 *  apart. It sits inside the frame (ModuleShell, the pool deck, Help, the sign-in card), which
 *  owns the main landmark and the page inset, so it adds neither. `scripts/lint/ui-rules.mjs`
 *  and `turnfin/page-header-in-shell` check that every page has one, with its header here. */
export function PageShell({ header, children }: {
  header: ReactElement<React.ComponentProps<typeof PageHeader>, typeof PageHeader>;
  children?: ReactNode;
}) {
  return (
    <div data-page-shell="" className="flex min-w-0 flex-col gap-4">
      {header}
      {children}
    </div>
  );
}
