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
    <div className="min-w-0 flex flex-col gap-4 items-start justify-between sm:flex-row">
      <div className="min-w-0 flex-1">
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-ui-muted-foreground block">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="min-w-0 flex gap-2 items-center flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
