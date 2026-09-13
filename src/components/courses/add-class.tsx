"use client";

import { useId, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import { DAY_META, DAYS_IN_ORDER } from "@/lib/courses/constants";
import { createCourse } from "@/lib/courses/actions/courses";
import { readCourseInput, UNASSIGNED_INSTRUCTOR } from "@/lib/courses/form-input";
import type { InstructorOption } from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";
import { toast } from "@/lib/toast";
import { withTimeout } from "@/lib/save-feedback";

export function AddClass({ levels, instructors, workingSite }: { levels: LevelOption[]; instructors: InstructorOption[]; workingSite: string }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const error = feedback.message;
  const [pending, startSave] = useTransition();
  const groups = new Map<string, { name: string; levels: LevelOption[] }>();
  for (const level of levels) {
    const group = groups.get(level.programme.id) ?? { name: level.programme.name, levels: [] };
    group.levels.push(level); groups.set(level.programme.id, group);
  }
  function changeOpen(next: boolean) { if (!pending) { setOpen(next); feedback.reset(); } }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button><Plus aria-hidden="true" />Add class</Button></DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={!pending}>
      <DialogHeader className="shrink-0 border-b border-ui-border p-6 pr-14 text-left"><DialogTitle>Add a class</DialogTitle><DialogDescription>A weekly class at {workingSite}, your current working site.</DialogDescription></DialogHeader>
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} aria-busy={pending} className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
        event.preventDefault(); if (pending) return;
        const input = readCourseInput(new FormData(event.currentTarget)); feedback.reset();
        startSave(async () => {
          try {
            const result = await withTimeout(createCourse(input));
            if (!result.ok) { feedback.report(result); return; }
            setOpen(false); toast.success("Class added"); router.refresh();
          } catch { feedback.report("Could not confirm the save. Check the class list before trying again. Your entries are still here."); }
        });
      }}>
        <div className="min-h-0 overflow-y-auto"><fieldset disabled={pending} className="min-w-0 space-y-5 p-6">
          {!levels.length ? <Alert><AlertDescription>No active levels are available. Add a level before creating a class.</AlertDescription></Alert> : null}
          <Select id={`${id}-level`} name="levelId" label="Level" required disabled={pending} placeholder="Choose a level" options={[...groups.values()].map(group => ({title: group.name, options: group.levels.map(level => ({value: level.id, label: level.name}))}))} />
          <Entry name="name" label="Class name" maxLength={80} hint="Optional. Leave blank to use the level name." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select id={`${id}-day`} name="dayOfWeek" label="Day" defaultValue="MONDAY" disabled={pending} options={DAYS_IN_ORDER.map(day => ({value: day, label: DAY_META[day].label}))} />
            <Entry name="startTime" label="Start time" type="time" defaultValue="16:30" required />
            <Entry name="durationMinutes" label="Duration (minutes)" type="number" min={5} max={240} step={5} defaultValue={30} required />
            <Entry name="capacity" label="Capacity" type="number" min={1} max={999} hint="Leave blank for no limit." />
          </div>
          <Select id={`${id}-instructor`} name="instructorId" label="Instructor" defaultValue={UNASSIGNED_INSTRUCTOR} disabled={pending} options={[{value: UNASSIGNED_INSTRUCTOR, label:"Not assigned"}, ...instructors.map(instructor => ({value: instructor.id,label: instructor.name}))]} />
          <Entry name="location" label="Pool area" maxLength={80} placeholder="Learner Pool, Lane 3…" />
        </fieldset></div>
        <div className="shrink-0 space-y-3 border-t border-ui-border p-4 sm:px-6">
          {error ? <Alert ref={summaryRef} tabIndex={-1} variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Cancel</Button><LoadingButton type="submit" pending={pending} pendingLabel="Adding class…" disabled={!levels.length}>Add class</LoadingButton></DialogFooter>
        </div>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}

function Entry({ label, hint, ...props }: ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return <Input {...props} label={label} description={hint} />;
}
