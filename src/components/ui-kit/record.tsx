import { Check, CircleHelp, X, type LucideIcon } from "lucide-react";

/** A record's page in Turnfin Glass (DESIGN.md; Refunds and Coinage, after Incidents): what happens
 *  next beside the record, the record as cards of label and value rows under section titles, and
 *  its history. These are the pieces; the app decides every word and lays them out in `.rec-layout`
 *  (kit.css): `.rec-next` beside `.rec-main`, `.rec-side` under it, one column on phones with the
 *  next action first. No business rules here. */

/** A section: its title above its card (DESIGN.md, The page shell). */
export function RecordSection({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col">
      <div className="pc-section-head"><h2 id={id}>{title}</h2>{aside}</div>
      {children}
    </section>
  );
}

/** Label and value rows with hairlines between (DESIGN.md, Content: rows). `wide` rows stack, for
 *  long text. */
export function RecordFacts({ items }: { items: [label: string, value: React.ReactNode, wide?: boolean][] }) {
  return (
    <dl className="rec-facts">
      {items.map(([label, value, wide]) => (
        <div key={label} className="rec-fact" data-wide={wide ? "" : undefined}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

export type RecordStepState = "done" | "current" | "waiting" | "stopped" | "todo";
const STEP_ICON: Record<RecordStepState, LucideIcon | null> = { done: Check, current: null, waiting: CircleHelp, stopped: X, todo: null };

/** Where a record has got to, down the card: filled when done, ringed where it is now, orange while
 *  it waits on someone else, red where it stopped. */
export function RecordSteps({ steps, label = "Where it has got to" }: { steps: { label: string; hint: string; state: RecordStepState }[]; label?: string }) {
  return (
    <ol className="rec-steps" aria-label={label}>
      {steps.map((step) => {
        const Icon = STEP_ICON[step.state];
        return (
          <li key={step.label} data-state={step.state} aria-current={step.state === "current" || step.state === "waiting" ? "step" : undefined}>
            <span className="rec-step-dot" aria-hidden="true">{Icon ? <Icon /> : null}</span>
            <span className="rec-step-label">{step.label}</span>
            <span className="rec-step-hint">{step.hint}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** What happens next: tinted blue while the move is this person's. */
export function RecordNext({ act, label, title = "Next action", body, children }: { act: boolean; label: string; title?: string; body: React.ReactNode; children?: React.ReactNode }) {
  return (
    <aside className="rec-card rec-next" data-tone={act ? "act" : undefined} aria-labelledby="rec-next-title">
      <p className="rec-next-label">{label}</p>
      <h2 id="rec-next-title" className="rec-next-title">{title}</h2>
      <p className="rec-muted">{body}</p>
      {children}
    </aside>
  );
}

/** The history as a quiet line of dots: green when something was decided for, orange when sent
 *  back, red when closed. `extra` holds what was recorded at that step, opened in place. */
export function RecordHistory({ items }: { items: { key: string; title: string; meta: string; note?: string | null; tone?: "done" | "warn" | "stop"; extra?: React.ReactNode }[] }) {
  return (
    <ol className="rec-card rec-history">
      {items.map((item) => (
        <li key={item.key} data-tone={item.tone}>
          <span className="rec-history-dot" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="rec-history-title">{item.title}</p>
            <p className="rec-muted rec-small">{item.meta}</p>
            {item.note ? <p className="rec-history-note">{item.note}</p> : null}
            {item.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}
