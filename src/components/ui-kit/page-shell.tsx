import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PageHeader } from "@/components/ui-kit/page-header";

/** Every page's body (owner rule, 20 October 2026: every page uses PageShell and PageHeader).
 *  The page's PageHeader first, with the page's one H1, then its blocks in one column, 16px
 *  apart (24px when `spacing="roomy"`). It sits inside the frame (ModuleShell, the pool deck,
 *  Help, the sign-in card), which owns the main landmark and the page inset, so it adds neither.
 *  A page's own layout class (`rota-plan`) and data attributes go on it as well.
 *  `scripts/lint/ui-rules.mjs` and `turnfin/page-header-in-shell` check that every page has
 *  one, with its header here. */
export function PageShell({ header, children, spacing, className, ...rest }: {
  header: ReactElement<ComponentProps<typeof PageHeader>, typeof PageHeader>;
  children?: ReactNode;
  spacing?: "roomy";
} & Omit<ComponentProps<"div">, "children">) {
  return (
    <div data-page-shell="" className={cn("flex min-w-0 flex-col", spacing === "roomy" ? "gap-6" : "gap-4", className)} {...rest}>
      {header}
      {children}
    </div>
  );
}
