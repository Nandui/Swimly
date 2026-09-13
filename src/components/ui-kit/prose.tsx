import { Badge } from "@/components/shadcn/badge";

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
    <span className="text-sm text-ui-foreground font-medium tabular-nums">
      {children}
    </span>
  );
}

/** A count that wants noticing — attendance still to take, swimmers gone
 *  quiet. The metadata maps each state to its semantic badge tone. */
export function Alert({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "error";
}) {
  const tones = { warning: "yellow", error: "red" } as const;
  return (
    <Badge variant="secondary" data-tone={tones[tone]}>
      {children}
    </Badge>
  );
}
