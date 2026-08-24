import type { LucideIcon } from "lucide-react";

/** Friendly Notion-style empty state: one line + a primary action. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center">
      {Icon ? <Icon className="mb-3 size-6 text-muted-foreground/60" strokeWidth={1.5} /> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
