"use client";

import { useId, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { DAY_META, DAYS_IN_ORDER } from "@/lib/courses/constants";
import { createCourse } from "@/lib/courses/actions/courses";
import { readCourseInput, UNASSIGNED_INSTRUCTOR } from "@/lib/courses/form-input";
import type { InstructorOption } from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";
import { toast } from "@/lib/toast";

export function AddClass({ levels, instructors, workingSite }: { levels: LevelOption[]; instructors: InstructorOption[]; workingSite: string }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startSave] = useTransition();
  const groups = new Map<string, { name: string; levels: LevelOption[] }>();
  for (const level of levels) {
    const group = groups.get(level.programme.id) ?? { name: level.programme.name, levels: [] };
    group.levels.push(level); groups.set(level.programme.id, group);
  }
  function changeOpen(next: boolean) { if (!pending) { setOpen(next); setError(""); } }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button><Plus aria-hidden="true" />Add class</Button></DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={!pending}>
      <DialogHeader className="shrink-0 border-b border-ui-border p-6 pr-14 text-left"><DialogTitle>Add a class</DialogTitle><DialogDescription>A weekly class at {workingSite}, your current working site.</DialogDescription></DialogHeader>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
        event.preventDefault(); if (pending) return;
        const input = readCourseInput(new FormData(event.currentTarget)); setError("");
        startSave(async () => {
          try {
            const result = await createCourse(input);
            if (!result.ok) { setError(result.error); return; }
            setOpen(false); toast.success("Class added"); router.refresh();
          } catch { setError("Could not add the class. Your details are still here — please try again."); }
        });
      }}>
        <div className="min-h-0 overflow-y-auto"><fieldset disabled={pending} className="min-w-0 space-y-5 p-6">
          {!levels.length ? <Alert><AlertDescription>No active levels are available. Add a level before creating a class.</AlertDescription></Alert> : null}
          <div className="space-y-2"><Label htmlFor={`${id}-level`}>Level <span className="text-ui-muted-foreground">(required)</span></Label><Select name="levelId" required disabled={pending}><SelectTrigger id={`${id}-level`} className="w-full"><SelectValue placeholder="Choose a level" /></SelectTrigger><SelectContent>{[...groups.entries()].map(([key, group]) => <SelectGroup key={key}><SelectLabel>{group.name}</SelectLabel>{group.levels.map(level => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}</SelectGroup>)}</SelectContent></Select></div>
          <Entry name="name" label="Class name" maxLength={80} hint="Optional. Leave blank to use the level name." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`${id}-day`}>Day</Label><Select name="dayOfWeek" defaultValue="MONDAY" disabled={pending}><SelectTrigger id={`${id}-day`} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{DAYS_IN_ORDER.map(day => <SelectItem key={day} value={day}>{DAY_META[day].label}</SelectItem>)}</SelectContent></Select></div>
            <Entry name="startTime" label="Start time" type="time" defaultValue="16:30" required />
            <Entry name="durationMinutes" label="Duration (minutes)" type="number" min={5} max={240} step={5} defaultValue={30} required />
            <Entry name="capacity" label="Capacity" type="number" min={1} max={999} hint="Leave blank for no limit." />
          </div>
          <div className="space-y-2"><Label htmlFor={`${id}-instructor`}>Instructor</Label><Select name="instructorId" defaultValue={UNASSIGNED_INSTRUCTOR} disabled={pending}><SelectTrigger id={`${id}-instructor`} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNASSIGNED_INSTRUCTOR}>Not assigned</SelectItem>{instructors.map(instructor => <SelectItem key={instructor.id} value={instructor.id}>{instructor.name}</SelectItem>)}</SelectContent></Select></div>
          <Entry name="location" label="Pool area" maxLength={80} placeholder="Learner Pool, Lane 3…" />
        </fieldset></div>
        <div className="shrink-0 space-y-3 border-t border-ui-border p-4 sm:px-6">
          {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" disabled={pending || !levels.length}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{pending ? "Adding class…" : "Add class"}</Button></DialogFooter>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

function Entry({ label, hint, ...props }: ComponentProps<typeof Input> & { label: string; hint?: string }) {
  const id = useId();
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label><Input {...props} id={id} aria-describedby={hint ? `${id}-hint` : undefined} />{hint ? <p id={`${id}-hint`} className="text-xs text-ui-muted-foreground">{hint}</p> : null}</div>;
}
