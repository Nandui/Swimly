"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/ui/textarea";
import { confirmLevelCompletion, revokeLevelCompletion, saveAssessment } from "@/modules/activities/shared/progression/actions/assess";
import type { LevelProgress, ProgrammeProgress } from "@/modules/activities/shared/progression/data/progress";
import { COMPETENCY_STATUS_META, NOT_MARKED_META } from "@/modules/activities/shared/progression/constants";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { CompetencyHistory } from "@/modules/activities/features/students/components/profile-history";
import { ProfileActionDialog } from "@/modules/activities/features/students/components/profile-action-dialog";
import { ProfileField } from "@/modules/activities/features/students/components/profile-enrolments";
import styles from "@/modules/activities/features/students/components/swimmer-profile.module.css";

type Access = { assess: boolean; complete: boolean; override: boolean };
export function ProfileCompetencies({ studentId, programmes, access, selectedLevel }: { studentId: string; programmes: ProgrammeProgress[]; access: Access; selectedLevel: string | null }) {
  if (!programmes.length) return <section className="pc-panel"><EmptyState compact title="No progress recorded yet" hint="Competencies appear when the swimmer is enrolled or has a recorded placement." /></section>;
  return <div className="flex flex-col gap-4">{programmes.map(programme => <section key={programme.programmeId} className="pc-panel" aria-labelledby={`programme-${programme.programmeId}`}><h2 id={`programme-${programme.programmeId}`}>{programme.programmeName}</h2>
    <div className="flex flex-col gap-2">{programme.levels.map(level => <LevelChapter key={level.id} level={level} selectedLevel={selectedLevel}>
      <CollapsibleTrigger className={`${styles.chapterTrigger} group`}><span className="min-w-0 flex-1"><span className="block font-semibold">{level.name}</span><span className="pc-row-hint block">{level.completedOn ? `Completed ${formatDate(level.completedOn)}` : level.total ? `${level.achieved} of ${level.total} achieved` : "No competencies set"}</span></span><ChevronDown aria-hidden="true" className="mt-1 size-4 shrink-0 text-ui-muted-foreground group-data-[state=open]:rotate-180" /></CollapsibleTrigger>
      <div className={styles.levelContent}>
        {level.completedOn ? <div className="space-y-1"><p className="text-sm">Confirmed by {level.confirmedByName ?? "an instructor"}{level.completionSnapshot ? ` · ${level.completionSnapshot.achieved} of ${level.completionSnapshot.total} at completion` : ""}</p>{level.overrideReason ? <p className="text-sm">Reason: {level.overrideReason}</p> : null}</div> : null}
        <ProfileMarks studentId={studentId} level={level} editable={access.assess && !level.completedOn && !level.archived} />
        {access.complete && !level.archived && !level.completedOn && level.total > 0 && (level.eligible || access.override) ? <ProfileActionDialog trigger={<Button variant="outline">Confirm level completion</Button>} title={`Complete ${level.name}`} description={`${level.achieved} of ${level.total} competencies achieved. This records a confirmed milestone.`} submitLabel="Confirm completion" success="Level completed" submit={data => confirmLevelCompletion({ studentId, levelId: level.id, note: String(data.get("note") ?? ""), overrideReason: String(data.get("overrideReason") ?? "") })}>
          {!level.eligible ? <ProfileField label="Reason for completing with gaps"><Textarea name="overrideReason" aria-label="Reason for completing with gaps" required maxLength={300} /></ProfileField> : null}<ProfileField label="Completion note"><Textarea name="note" aria-label="Completion note" maxLength={300} /></ProfileField>
        </ProfileActionDialog> : null}
        {access.override && level.completionId ? <ProfileActionDialog trigger={<Button variant="outline">Correct completion</Button>} title={`Take back completion of ${level.name}`} description="The correction and its reason remain in the swimmer’s history." submitLabel="Take back completion" submit={data => revokeLevelCompletion(level.completionId!, { reason: String(data.get("reason") ?? "") })}><ProfileField label="Reason"><Textarea name="reason" aria-label="Reason for taking back completion" required maxLength={300} /></ProfileField></ProfileActionDialog> : null}
      </div>
    </LevelChapter>)}</div>
  </section>)}</div>;
}

function LevelChapter({ level, selectedLevel, children }: { level: LevelProgress; selectedLevel: string | null; children: React.ReactNode[] }) {
  const [selection, setSelection] = useState(selectedLevel);
  const [open, setOpen] = useState(selectedLevel ? level.id === selectedLevel : level.isCurrent);
  if (selection !== selectedLevel) { setSelection(selectedLevel); setOpen(level.id === selectedLevel); }
  return <Collapsible open={open} onOpenChange={setOpen} className={styles.level}>{children[0]}<CollapsibleContent forceMount hidden={!open}>{children.slice(1)}</CollapsibleContent></Collapsible>;
}

function ProfileMarks({ studentId, level, editable }: { studentId: string; level: LevelProgress; editable: boolean }) {
  const [edits, setEdits] = useState<Record<string, "ACHIEVED" | "WORKING_ON" | null>>({});
  const marks = Object.fromEntries(level.competencies.map(c => [c.id, Object.hasOwn(edits, c.id) ? edits[c.id] : c.status]));
  const [pending, startTransition] = useTransition(), [error, setError] = useState("");
  const router = useRouter();
  const dirty = level.competencies.some(c => c.status !== marks[c.id]);
  if (!level.competencies.length) return <EmptyState compact title="No competencies set for this level" />;
  return <div className="space-y-3"><ul className="pc-rows">{level.competencies.map(c => <li key={c.id} className="pc-row">
    <div className="pc-row-body basis-56"><p className="pc-row-title">{c.name}{c.archived ? " · Archived" : ""}</p>{c.description ? <p className="pc-row-hint">{c.description}</p> : null}<p className="pc-row-hint">{c.assessedByName ? `${c.assessedByName}${c.assessedOn ? ` · ${formatDate(c.assessedOn)}` : ""}` : "No mark recorded"}</p></div>
    <div className="pc-row-trail">{editable && !c.archived ? <Select value={marks[c.id] ?? "unmarked"} disabled={pending} onValueChange={value => setEdits(old => ({ ...old, [c.id]: value === "unmarked" ? null : value as "ACHIEVED" | "WORKING_ON" }))}><SelectTrigger aria-label={`Mark for ${c.name}`} className="min-w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unmarked">{NOT_MARKED_META.label}</SelectItem><SelectItem value="WORKING_ON">{COMPETENCY_STATUS_META.WORKING_ON.label}</SelectItem><SelectItem value="ACHIEVED">{COMPETENCY_STATUS_META.ACHIEVED.label}</SelectItem></SelectContent></Select> : <Tag meta={c.status ? COMPETENCY_STATUS_META[c.status] : NOT_MARKED_META} />}<CompetencyHistory studentId={studentId} id={c.id} name={c.name} /></div>
  </li>)}</ul>
    {error ? <Notice tone="error" live="alert" title={error} /> : null}
    {editable && level.total > 0 ? <div className="flex flex-wrap items-center gap-3"><LoadingButton pending={pending} disabled={!dirty} aria-describedby={`marks-hint-${level.id}`} onClick={() => startTransition(async () => { setError(""); try { const result = await saveAssessment({ studentId, levelId: level.id, results: level.competencies.filter(c => c.status !== marks[c.id]).map(c => ({ competencyId: c.id, status: marks[c.id] })) }); if (!result.ok) { setError(result.error); return; } setEdits({}); toast.success("Competency marks saved"); router.refresh(); } catch { setError("Could not confirm the save. Check the swimmer’s history before trying again. Your marks are still here."); } })}>Save marks</LoadingButton><span id={`marks-hint-${level.id}`} className="text-sm text-ui-muted-foreground" role="status">{pending ? "Saving your marks…" : dirty ? "Unsaved changes" : "Change a mark to enable saving."}</span></div> : null}
  </div>;
}
