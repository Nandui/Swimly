"use client";

import { useId, useState, useTransition, type ComponentProps, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/ui/textarea";
import { createStudent, updateStudent } from "@/lib/students/actions/students";
import type { StudentDetail } from "@/lib/students/data/students";
import { toDateOnlyString } from "@/lib/format";
import { readStudentInput } from "@/lib/students/form-input";
import { swimmerProfileHref } from "@/lib/students/directory";
import { toast } from "@/lib/toast";
import { withTimeout } from "@/lib/save-feedback";

export function AddSwimmer({ student, trigger }: { student?: StudentDetail; trigger?: ReactElement } = {}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const error = feedback.message;
  const [pending, startTransition] = useTransition();
  const id = useId();
  const router = useRouter();
  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) { feedback.reset(); setExpanded(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>{trigger ?? <Button variant={student ? "outline" : "default"}>{student ? "Edit details" : <><Plus aria-hidden="true" />Add swimmer</>}</Button>}</DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl [&_button:not([role=checkbox])]:min-h-11 [&_input:not([type=hidden])]:min-h-11 [&>button]:inline-flex [&>button]:min-w-11 [&>button]:items-center [&>button]:justify-center" showCloseButton={!pending}>
      <DialogHeader className="shrink-0 border-b border-ui-border p-6 pr-14 text-left">
        <DialogTitle>{student ? "Edit swimmer details" : "Add a swimmer"}</DialogTitle>
        <DialogDescription>{student ? "Update their shared profile and contact details." : "Start with their name. You can complete the rest now or in their profile."}</DialogDescription>
      </DialogHeader>
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} aria-busy={pending} className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const input = readStudentInput(new FormData(event.currentTarget));
        feedback.reset();
        startTransition(async () => {
          try {
            const result = await withTimeout(student ? updateStudent(student.id, input) : createStudent(input));
            if (!result.ok) { feedback.report(result); if (Object.keys(result.fieldErrors ?? {}).some(name => ["emergencyName", "emergencyPhone", "emergencyRelationship", "medicalNotes", "notes"].includes(name))) setExpanded(true); return; }
            setOpen(false); setExpanded(false);
            toast.success(student ? "Details saved" : "Swimmer added");
            if ("studentId" in result && typeof result.studentId === "string") router.push(swimmerProfileHref(result.studentId));
            router.refresh();
          } catch { feedback.report("Could not confirm the save. Check the swimmer directory before trying again. Your entries are still here."); }
        });
      }}>
        <div className="min-h-0 overflow-y-auto"><fieldset disabled={pending} className="min-w-0 space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Entry label="First name" name="firstName" required maxLength={60} autoComplete="given-name" defaultValue={student?.firstName} />
            <Entry label="Last name" name="lastName" required maxLength={60} autoComplete="family-name" defaultValue={student?.lastName} />
            <Entry label="Date of birth" name="dateOfBirth" type="date" defaultValue={student?.dateOfBirth ? toDateOnlyString(student.dateOfBirth) : ""} />
            <Entry label="Member number" name="memberNumber" maxLength={40} defaultValue={student?.memberNumber ?? ""} />
          </div>
          <section aria-label="Main contact" className="space-y-4">
            <h3 className="text-sm font-semibold">Main contact</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Entry label="Contact name" name="contactName" maxLength={120} defaultValue={student?.contactName ?? ""} />
              <Entry label="Phone" name="contactPhone" type="tel" maxLength={40} defaultValue={student?.contactPhone ?? ""} />
            </div>
            <Entry label="Email" name="contactEmail" type="email" defaultValue={student?.contactEmail ?? ""} />
          </section>
          <Collapsible open={expanded} onOpenChange={setExpanded} className="border-t border-ui-border pt-3">
            <CollapsibleTrigger asChild><Button variant="ghost" type="button" className="w-full justify-between whitespace-normal text-left">
              Emergency contact, notes and consent<ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : ""} />
            </Button></CollapsibleTrigger>
            <CollapsibleContent forceMount hidden={!expanded} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Entry label="Emergency contact name" name="emergencyName" maxLength={120} defaultValue={student?.emergencyName ?? ""} />
                <Entry label="Emergency phone" name="emergencyPhone" type="tel" maxLength={40} defaultValue={student?.emergencyPhone ?? ""} />
              </div>
              <Entry label="Relationship" name="emergencyRelationship" maxLength={60} defaultValue={student?.emergencyRelationship ?? ""} />
              <Textarea id={`${id}-medical`} label="Medical notes" name="medicalNotes" maxLength={2000} rows={3} defaultValue={student?.medicalNotes ?? ""} description="Shown as a flag on attendance, with details available to staff." />
              <Textarea id={`${id}-notes`} label="Other notes" name="notes" maxLength={2000} rows={2} defaultValue={student?.notes ?? ""} />
              <Label className="min-h-11 gap-3" htmlFor={`${id}-consent`}><Checkbox id={`${id}-consent`} name="photoConsent" defaultChecked={student?.photoConsent} />Photo and video consent</Label>
            </CollapsibleContent>
          </Collapsible>
          <div className="space-y-2"><Label htmlFor={`${id}-status`}>Status</Label><Select name="status" defaultValue={student?.status ?? "ACTIVE"} disabled={pending}><SelectTrigger id={`${id}-status`} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem className="min-h-11" value="ACTIVE">Active</SelectItem><SelectItem className="min-h-11" value="INACTIVE">Inactive</SelectItem></SelectContent></Select></div>
        </fieldset></div>
        <div className="shrink-0 space-y-3 border-t border-ui-border p-4 sm:px-6">
          {error ? <Alert ref={summaryRef} tabIndex={-1} variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={pending}>Cancel</Button><LoadingButton type="submit" pending={pending}>{student ? "Save details" : "Add and open profile"}</LoadingButton></DialogFooter>
        </div>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}

function Entry({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  return <Input {...props} label={label} />;
}
