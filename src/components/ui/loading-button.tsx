import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

/** Both labels reserve space, so progress never shifts adjacent controls. */
export function LoadingButton({ pending, pendingLabel = "Saving…", children, disabled, className, ...props }: Omit<ComponentProps<typeof Button>, "asChild"> & {
  pending: boolean;
  pendingLabel?: string;
}) {
  return <Button {...props} disabled={disabled || pending} aria-busy={pending} className={cn("grid", className)}>
    <span aria-hidden={pending} data-motion="action-label" className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">{children}</span>
    <span aria-hidden={!pending} data-motion="action-label" className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"><Loader2 className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />{pendingLabel}</span>
  </Button>;
}
