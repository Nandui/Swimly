/** The page's opening: one H1, a quiet description line, actions at the end.
 *  The title keeps a readable width; when the actions do not fit beside it
 *  they wrap underneath instead of squeezing it (a phone, or a page with
 *  several actions). */
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
    <div className="min-w-0 flex flex-wrap gap-x-6 gap-y-4 items-end justify-between">
      <div className="min-w-0 flex flex-col gap-1 grow basis-[min(100%,22rem)]">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="text-sm text-ui-muted-foreground block">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="min-w-0 flex gap-2 items-center flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
