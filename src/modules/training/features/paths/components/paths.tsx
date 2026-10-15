"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, LogOut, Pencil, Plus, UserPlus, X } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { today } from "@/lib/format";
import { enrolInPath, leavePath, savePath, setPathArchived } from "@/modules/training/features/paths/server/actions";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { PeopleChooser, type ChoosablePerson } from "@/modules/training/shared/components/people-chooser";

/** Learning paths (e-learning phase 5): building a path of courses in order,
 *  putting people on it, and taking them off. */

type Step = { key: string; courseId: string; dueDays: string };
const key = () => crypto.randomUUID().slice(0, 8);

export function PathDialog({ courses, path }: {
  courses: { id: string; title: string }[];
  path?: { id: string; title: string; summary: string; steps: { courseId: string; dueDays: number }[] };
}) {
  const router = useRouter();
  const start = (): Step[] => path?.steps.map((s) => ({ key: key(), courseId: s.courseId, dueDays: String(s.dueDays) })) ?? [{ key: key(), courseId: "", dueDays: "7" }];
  const [steps, setSteps] = useState<Step[]>(start);
  const move = (i: number, by: -1 | 1) => setSteps((now) => { const next = [...now]; [next[i], next[i + by]] = [next[i + by], next[i]]; return next; });
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={path
        ? <Button variant="outline" className="min-h-11"><Pencil aria-hidden="true" />Change path</Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />New path</Button>}
      title={path ? `Change ${path.title}` : "New learning path"}
      description="Courses in the order people take them, each due a number of days after they start. People already on the path keep the courses and dates they were given."
      submitLabel={path ? "Save path" : "Add path"}
      successMessage={path ? "Path saved" : "Path added"}
      onOpen={() => setSteps(start())}
      onSuccess={() => router.refresh()}
      submit={async (formData) => {
        const result = await savePath(path?.id ?? null, {
          title: String(formData.get("title") ?? ""), summary: String(formData.get("summary") ?? ""),
          steps: steps.filter((s) => s.courseId).map((s) => ({ courseId: s.courseId, dueDays: Number(s.dueDays || 0) })),
        });
        if (result.ok && !path) router.push(`/training/paths/${result.id}`);
        return result.ok ? { ok: true } : result;
      }}
    >
      <Input id="path-title" name="title" label="Name" required maxLength={120} defaultValue={path?.title} placeholder="New lifeguard: first month" />
      <Field label="What it is for" htmlFor="path-summary" optional>
        <Textarea id="path-summary" name="summary" rows={2} maxLength={500} defaultValue={path?.summary} />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Courses, in order</legend>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-[var(--pc-radius-card)] bg-ui-muted p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
              <Field label={`Course ${i + 1}`} htmlFor={`step-course-${step.key}`}>
                <NativeSelect id={`step-course-${step.key}`} value={step.courseId} required className="min-h-11 w-full"
                  onChange={(event) => setSteps((now) => now.map((s) => s.key === step.key ? { ...s, courseId: event.target.value } : s))}>
                  <NativeSelectOption value="" disabled>Choose a course</NativeSelectOption>
                  {courses.map((c) => <NativeSelectOption key={c.id} value={c.id} disabled={steps.some((s) => s.key !== step.key && s.courseId === c.id)}>{c.title}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Input id={`step-days-${step.key}`} label="Due after (days)" type="number" inputMode="numeric" min={0} max={365} required value={step.dueDays}
                onChange={(value) => setSteps((now) => now.map((s) => s.key === step.key ? { ...s, dueDays: value } : s))} className="col-span-2 sm:col-span-1 sm:row-start-1 sm:col-start-2" />
              <span className="col-start-2 row-start-1 flex gap-1 sm:col-start-3">
                <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move course ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move course ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove course ${i + 1}`} disabled={steps.length <= 1} onClick={() => setSteps((now) => now.filter((s) => s.key !== step.key))}><X aria-hidden="true" /></Button>
              </span>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" className="min-h-11 self-start" disabled={steps.length >= Math.min(30, courses.length)}
          onClick={() => setSteps((now) => [...now, { key: key(), courseId: "", dueDays: String(Number(now.at(-1)?.dueDays ?? 0) + 7) }])}><Plus aria-hidden="true" />Add a course</Button>
      </fieldset>
    </FormDialog>
  );
}

export function ArchivePath({ id, title, archived }: { id: string; title: string; archived: boolean }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" className="min-h-11">{archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}{archived ? "Restore" : "Archive"}</Button>}
      title={archived ? `Restore ${title}?` : `Archive ${title}?`}
      description={archived ? "People can be put on it again." : "Nobody new can be put on it. People already on it keep their courses."}
      confirmLabel={archived ? "Restore path" : "Archive path"}
      successMessage={archived ? "Path restored" : "Path archived"}
      run={() => setPathArchived(id, !archived)}
    />
  );
}

export function EnrolInPath({ pathId, title, people }: { pathId: string; title: string; people: ChoosablePerson[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button className="min-h-11"><UserPlus aria-hidden="true" />Put people on it</Button>}
      title={`Put people on ${title}`}
      description="Each course they haven't finished is assigned, due the path's number of days after they start. Courses they already have open or have finished count."
      submitLabel="Put on path"
      successMessage="Done"
      onOpen={() => setChosen(new Set())}
      onSuccess={() => router.refresh()}
      submit={async (formData) => {
        const result = await enrolInPath(pathId, [...chosen], String(formData.get("startsOn") ?? ""));
        if (result.ok) toast.success(`${result.enrolled} on the path, ${result.assigned} ${result.assigned === 1 ? "course" : "courses"} assigned.`);
        return result.ok ? { ok: true } : result;
      }}
    >
      <Input id="enrol-start" name="startsOn" label="They start on" type="date" required defaultValue={today()} />
      <PeopleChooser idPrefix="enrol" people={people} chosen={chosen} onChange={setChosen} />
    </FormDialog>
  );
}

export function LeavePath({ enrolmentId, name, title }: { enrolmentId: string; name: string; title: string }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11" aria-label={`Take ${name} off ${title}`}><LogOut aria-hidden="true" /><span className="pc-only-wide">Take off</span></Button>}
      title={`Take ${name} off ${title}?`}
      description="Courses the path gave them that they haven't handed in are cancelled. Anything finished stays on their record."
      submitLabel="Take off path"
      destructive
      successMessage="Taken off the path"
      onSuccess={() => router.refresh()}
      submit={(formData) => leavePath(enrolmentId, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why" htmlFor="leave-reason">
        <Textarea id="leave-reason" name="reason" rows={2} required minLength={3} maxLength={300} />
      </Field>
    </FormDialog>
  );
}

