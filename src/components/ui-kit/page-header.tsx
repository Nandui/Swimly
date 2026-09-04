import { cn } from "@/lib/utils";

/** Notion-style page opening: plain H1, quiet description, actions right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {/* Wraps: a course page carries five actions, which is wider than a
          phone. Below the tablet breakpoint the row takes the full width and
          the buttons flow onto a second line rather than off the screen. */}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 max-md:w-full md:shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
