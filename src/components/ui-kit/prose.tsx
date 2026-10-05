/** Counts read as prose, with important numbers in foreground ink. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex flex-col gap-4 max-w-prose">
      <p className="text-sm text-ui-muted-foreground block">{children}</p>
    </div>
  );
}

/** A number inside a sentence. */
export function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm text-ui-foreground font-semibold tabular-nums">
      {children}
    </span>
  );
}
