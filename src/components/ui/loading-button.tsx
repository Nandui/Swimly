import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

/** Both labels reserve space, so progress never shifts adjacent controls; the
 *  inactive one is hidden (visibility), so only the live label names the button.
 *  While pending the button stays focusable (aria-disabled plus a click guard,
 *  which also stops implicit Enter submission) and a polite live region after it
 *  announces the pending label. */
export function LoadingButton({ pending, pendingLabel = "Saving…", children, disabled, className, onClick, ...props }: Omit<ComponentProps<typeof Button>, "asChild"> & {
  pending: boolean;
  pendingLabel?: string;
}) {
  return <>
    <Button {...props} disabled={disabled} aria-disabled={pending || undefined} aria-busy={pending} className={cn("grid", className)}
      onClick={event => { if (pending) { event.preventDefault(); return; } onClick?.(event); }}>
      <span aria-hidden={pending} data-motion="action-label" className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">{children}</span>
      <span aria-hidden={!pending} data-motion="action-label" className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"><Loader2 className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />{pendingLabel}</span>
    </Button>
    <span aria-live="polite" aria-atomic="true" className="sr-only">{pending ? pendingLabel : ""}</span>
  </>;
}
