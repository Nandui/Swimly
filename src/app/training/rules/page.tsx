import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { PauseRule, RemoveRule, RULE_STATE_META, RuleDialog, RunRulesNow, trainingRules } from "@/modules/training/features/compliance";

export const metadata: Metadata = { title: "Training rules" };

/** Training rules (e-learning phase 4): who must take which course and how often. Turnfin
 *  assigns them every morning and when a rule is saved. Managing them needs the Manage level for
 *  every site; anyone with Training access can read them. */
export default async function TrainingRulesPage() {
  const { canManage, rules, coursesWithout, options } = await trainingRules();
  const percent = (r: { covered: number; compliant: number }) => r.covered ? Math.floor((r.compliant / r.covered) * 100) : 100;
  return (
    <PageShell header={<PageHeader title="Training rules" description="Say who must take each course and how often. Turnfin assigns it to them every morning, including new starters and anyone due again."
        actions={canManage ? <div className="flex flex-wrap gap-2"><RunRulesNow /><RuleDialog options={options} courses={coursesWithout} /></div> : null} />}>
      {rules.length === 0 ? (
        <EmptyState as="h2" icon="graduation" title="No training rules yet" hint={canManage ? "Add one to stop assigning the same course by hand, for example safeguarding for everyone every year." : "Someone with the Manage level in Training can add them."} />
      ) : (
        <section className="pc-panel" aria-label="Training rules">
          <ul className="pc-rows">
            {rules.map((rule) => (
              <li key={rule.id} className="pc-row flex-wrap">
                <div className="pc-row-body">
                  <Link href={`/training/courses/${rule.courseId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{rule.title}</Link>
                  <p className="pc-row-hint">{[rule.audience, rule.timing, rule.grants ? `records ${rule.grants}` : null].filter(Boolean).join(" · ")}</p>
                  <p className="pc-row-hint tabular-nums">
                    {rule.covered ? `${rule.compliant} of ${rule.covered} in date (${percent(rule)}%)${rule.overdue ? ` · ${rule.overdue} overdue or out of date` : ""}` : "Covers nobody at the moment"}
                    {rule.lastRunAt ? ` · last run ${rule.lastRunAt.toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" })}` : ""}
                  </p>
                </div>
                <div className="pc-row-trail flex-wrap">
                  <Tag meta={RULE_STATE_META[rule.paused ? "paused" : rule.waiting ? "waiting" : "running"]} />
                  {canManage ? (
                    <>
                      <RuleDialog options={options} rule={{ courseId: rule.courseId, input: rule.input }} title={rule.title} />
                      <PauseRule id={rule.id} title={rule.title} paused={rule.paused} />
                      <RemoveRule id={rule.id} title={rule.title} />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-ui-muted-foreground">
        Cancelling training a rule assigned excuses that person until it would be due again. See where everyone stands in the <Link href="/training/matrix" className="text-ui-primary underline-offset-4 hover:underline">training matrix</Link>.
      </p>
    </PageShell>
  );
}
