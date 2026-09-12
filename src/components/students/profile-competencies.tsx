"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/shadcn/textarea";
import { confirmLevelCompletion, revokeLevelCompletion, saveAssessment } from "@/lib/progression/actions/assess";
import type { LevelProgress, ProgrammeProgress } from "@/lib/progression/data/progress";
import { COMPETENCY_STATUS_META } from "@/lib/progression/constants";
import { HISTORY_META } from "@/lib/students/history";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { CompetencyHistory } from "./profile-history";
import { ProfileActionDialog } from "./profile-action-dialog";
import { ProfileField } from "./profile-enrolments";

type Access = { assess: boolean; complete: boolean; override: boolean };
export function ProfileCompetencies({ studentId, programmes, access, selectedLevel }: { studentId: string; programmes: ProgrammeProgress[]; access: Access; selectedLevel: string | null }) {
  if (!programmes.length) return <p className="py-6 text-sm text-ui-muted-foreground">No progress recorded yet. Competencies appear when the swimmer is enrolled or has a recorded placement.</p>;
  return <div className="space-y-8">{programmes.map(programme => <section key={programme.programmeId} className="space-y-3"><h2 className="text-lg font-semibold">{programme.programmeName}</h2>
    {programme.levels.map(level => <LevelChapter key={level.id} level={level} selectedLevel={selectedLevel}>
      <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto min-h-12 w-full justify-between whitespace-normal px-0 py-3 text-left"><span>{level.name}{" "}<span className="ml-3 font-normal text-ui-muted-foreground">{level.completedOn ? `Completed ${formatDate(level.completedOn)}` : `${level.achieved} of ${level.total} achieved`}</span></span><ChevronDown aria-hidden="true" className="shrink-0" /></Button></CollapsibleTrigger>
      <div className="space-y-4 pb-5">
        {level.completedOn ? <div className="space-y-1"><p className="text-sm">Confirmed by {level.confirmedByName ?? "an instructor"}{level.completionSnapshot ? ` · ${level.completionSnapshot.achieved} of ${level.completionSnapshot.total} at completion` : ""}</p>{level.overrideReason ? <p className="text-sm">Reason: {level.overrideReason}</p> : null}</div> : null}
        <ProfileMarks studentId={studentId} level={level} editable={access.assess && !level.completedOn && !level.archived} />
        {access.complete && !level.archived && !level.completedOn && level.total > 0 && (level.eligible || access.override) ? <ProfileActionDialog trigger={<Button variant="outline">Confirm level completion</Button>} title={`Complete ${level.name}`} description={`${level.achieved} of ${level.total} competencies achieved. This records a confirmed milestone.`} submitLabel="Confirm completion" success="Level completed" submit={data => confirmLevelCompletion({ studentId, levelId: level.id, note: String(data.get("note") ?? ""), overrideReason: String(data.get("overrideReason") ?? "") })}>
          {!level.eligible ? <ProfileField label="Reason for completing with gaps"><Textarea name="overrideReason" aria-label="Reason for completing with gaps" required maxLength={300} /></ProfileField> : null}<ProfileField label="Completion note"><Textarea name="note" aria-label="Completion note" maxLength={300} /></ProfileField>
        </ProfileActionDialog> : null}
        {access.override && level.completionId ? <ProfileActionDialog trigger={<Button variant="outline">Correct completion</Button>} title={`Take back completion of ${level.name}`} description="The correction and its reason remain in the swimmer’s history." submitLabel="Take back completion" submit={data => revokeLevelCompletion(level.completionId!, { reason: String(data.get("reason") ?? "") })}><ProfileField label="Reason"><Textarea name="reason" aria-label="Reason for taking back completion" required maxLength={300} /></ProfileField></ProfileActionDialog> : null}
      </div>
    </LevelChapter>)}
  </section>)}</div>;
}

function LevelChapter({ level, selectedLevel, children }: { level: LevelProgress; selectedLevel: string | null; children: React.ReactNode[] }) {
  const [selection, setSelection] = useState(selectedLevel);
  const [open, setOpen] = useState(selectedLevel ? level.id === selectedLevel : level.isCurrent);
  if (selection !== selectedLevel) { setSelection(selectedLevel); setOpen(level.id === selectedLevel); }
  return <Collapsible open={open} onOpenChange={setOpen} className="border-b border-ui-border">{children[0]}<CollapsibleContent forceMount hidden={!open}>{children.slice(1)}</CollapsibleContent></Collapsible>;
}

function ProfileMarks({ studentId, level, editable }: { studentId: string; level: LevelProgress; editable: boolean }) {
  const [edits, setEdits] = useState<Record<string, "ACHIEVED" | "WORKING_ON" | null>>({});
  const marks = Object.fromEntries(level.competencies.map(c => [c.id, Object.hasOwn(edits, c.id) ? edits[c.id] : c.status]));
  const [pending, startTransition] = useTransition(), [error, setError] = useState("");
  const router = useRouter();
  const dirty = level.competencies.some(c => c.status !== marks[c.id]);
  return <div className="space-y-3"><ul className="divide-y divide-ui-border">{level.competencies.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div className="min-w-0 flex-1 basis-56"><p className="text-sm font-medium">{c.name}{c.archived ? " · Archived" : ""}</p>{c.description ? <p className="text-xs text-ui-muted-foreground">{c.description}</p> : null}<p className="mt-1 text-xs text-ui-muted-foreground">{c.assessedByName ? `${c.assessedByName}${c.assessedOn ? ` · ${formatDate(c.assessedOn)}` : ""}` : "No mark recorded"}</p></div>
    <div className="flex flex-wrap items-center gap-2">{editable && !c.archived ? <Select value={marks[c.id] ?? "unmarked"} disabled={pending} onValueChange={value => setEdits(old => ({ ...old, [c.id]: value === "unmarked" ? null : value as "ACHIEVED" | "WORKING_ON" }))}><SelectTrigger aria-label={`Mark for ${c.name}`} className="min-w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unmarked">Not marked</SelectItem><SelectItem value="WORKING_ON">Not Achieved</SelectItem><SelectItem value="ACHIEVED">Achieved</SelectItem></SelectContent></Select> : <Badge variant="secondary" data-tone={c.status ? COMPETENCY_STATUS_META[c.status].color : HISTORY_META.profile.color}>{c.status ? COMPETENCY_STATUS_META[c.status].label : "Not marked"}</Badge>}<CompetencyHistory studentId={studentId} id={c.id} name={c.name} /></div>
  </li>)}</ul>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {editable ? <div className="flex items-center gap-3"><Button disabled={pending || !dirty} onClick={() => startTransition(async () => { setError(""); try { const result = await saveAssessment({ studentId, levelId: level.id, results: level.competencies.filter(c => c.status !== marks[c.id]).map(c => ({ competencyId: c.id, status: marks[c.id] })) }); if (!result.ok) { setError(result.error); return; } setEdits({}); toast.success("Competency marks saved"); router.refresh(); } catch { setError("Could not confirm the save. Your marks are still here; please try again."); } })}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}Save marks</Button>{dirty ? <span className="text-sm text-ui-muted-foreground">Unsaved changes</span> : null}</div> : null}
  </div>;
}
