"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";

/** In place of figures a module failed to load (`homeCardItems`' `failed`), on the home page and
 *  a module's overview: say so, and offer to load the page again, rather than leaving them out. */
export function FiguresFailed({ modules }: { /** The modules' names, when more than one page's worth is missing. */ modules?: string[] }) {
  return (
    <Notice tone="error" title="Today's figures didn't load"
      description={modules?.length ? `Missing: ${modules.join(", ")}.` : undefined}
      actions={<Button type="button" variant="outline" onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" />Reload</Button>} />
  );
}
