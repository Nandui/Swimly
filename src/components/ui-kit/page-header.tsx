import { BackLink } from "@/components/ui-kit/back-link";

/** The page's opening: an optional back link to the parent page, one H1, a
 *  quiet description line, then status tags and actions at the end, bottom
 *  aligned with the primary action last. The H1 holds the title only; status
 *  tags go in `status`, never inside it. The title keeps a readable width;
 *  when the actions do not fit beside it they wrap underneath instead of
 *  squeezing it, and on phones the buttons share that row (poolside.css,
 *  `.pc-phead-actions`). poolside.css styles the H1. */
export function PageHeader({
  title,
  description,
  actions,
  status,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="min-w-0 flex flex-wrap gap-x-6 gap-y-4 items-end justify-between">
      <div className="min-w-0 flex flex-col gap-1 grow basis-[min(100%,22rem)]">
        {back ? <BackLink href={back.href} label={back.label} /> : null}
        <h1>{title}</h1>
        {description ? (
          <p className="text-sm text-ui-muted-foreground block">
            {description}
          </p>
        ) : null}
      </div>
      {status || actions ? (
        <div className="pc-phead-actions min-w-0 flex gap-2 items-center flex-wrap">
          {status}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
