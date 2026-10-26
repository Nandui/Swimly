import { Progress } from "@/components/shadcn/progress";
import { progressOf } from "@/components/ui-kit/scale";

/** How far through a set of things (DESIGN.md, ProgressRing): a green ring that fills as each
 *  one is done, with the figure inside it ("5 of 8 here"). It is shadcn's Progress, drawn as a
 *  ring in kit.css, so screen readers hear the progress bar and its label; the figure inside is
 *  for the eye. The caller decides the words. */
export function ProgressRing({ value, max, label, children }: {
  value: number;
  max: number;
  /** What a screen reader hears: "5 of 8 swimmers here". */
  label: string;
  /** The figure and its line inside the ring. */
  children?: React.ReactNode;
}) {
  const share = max > 0 ? value / max : 0;
  return (
    <span className="progress-ring-wrap">
      <Progress value={Math.round(share * 100)} aria-label={label} className={`progress-ring ${progressOf(share)}`} />
      {children ? <span className="progress-ring-figure" aria-hidden="true">{children}</span> : null}
    </span>
  );
}
