"use client";

import { useId, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/shadcn/textarea";
import { createStudent, updateStudent } from "@/lib/students/actions/students";
import type { StudentDetail } from "@/lib/students/data/students";
import { toDateOnlyString } from "@/lib/format";
import { readStudentInput } from "@/lib/students/form-input";
import { swimmerProfileHref } from "@/lib/students/directory";
import { toast } from "@/lib/toast";

export function AddSwimmer({ student }: { student?: StudentDetail } = {}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();
  const router = useRouter();
  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) { setError(""); setExpanded(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant={student ? "outline" : "default"}>{student ? "Edit details" : <><Plus aria-hidden="true" />Add swimmer</>}</Button></DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={!pending}>
      <DialogHeader className="shrink-0 border-b border-ui-border p-6 pr-14 text-left">
        <DialogTitle>{student ? "Edit swimmer details" : "Add a swimmer"}</DialogTitle>
        <DialogDescription>{student ? "Update their shared profile and contact details." : "Start with their name. You can complete the rest now or in their profile."}</DialogDescription>
      </DialogHeader>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const input = readStudentInput(new FormData(event.currentTarget));
        setError("");
        startTransition(async () => {
          try {
            const result = student ? await updateStudent(student.id, input) : await createStudent(input);
            if (!result.ok) { setError(result.error); return; }
            setOpen(false); setExpanded(false);
            toast.success(student ? "Details saved" : "Swimmer added");
            if ("studentId" in result && typeof result.studentId === "string") router.push(swimmerProfileHref(result.studentId));
            router.refresh();
          } catch { setError("Could not save the swimmer. Your details are still here — please try again."); }
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
              <div className="space-y-2"><Label htmlFor={`${id}-medical`}>Medical notes</Label><Textarea id={`${id}-medical`} name="medicalNotes" maxLength={2000} rows={3} defaultValue={student?.medicalNotes ?? ""} aria-describedby={`${id}-medical-hint`} /><p id={`${id}-medical-hint`} className="text-xs text-ui-muted-foreground">Shown as a flag on attendance, with details available to staff.</p></div>
              <div className="space-y-2"><Label htmlFor={`${id}-notes`}>Other notes</Label><Textarea id={`${id}-notes`} name="notes" maxLength={2000} rows={2} defaultValue={student?.notes ?? ""} /></div>
              <Label className="min-h-11 gap-3" htmlFor={`${id}-consent`}><Checkbox id={`${id}-consent`} name="photoConsent" defaultChecked={student?.photoConsent} />Photo and video consent</Label>
            </CollapsibleContent>
          </Collapsible>
          <div className="space-y-2"><Label htmlFor={`${id}-status`}>Status</Label><Select name="status" defaultValue={student?.status ?? "ACTIVE"} disabled={pending}><SelectTrigger id={`${id}-status`} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent></Select></div>
        </fieldset></div>
        <div className="shrink-0 space-y-3 border-t border-ui-border p-4 sm:px-6">
          {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{pending ? "Saving…" : student ? "Save details" : "Add and open profile"}</Button></DialogFooter>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

function Entry({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}{props.required ? <span className="text-ui-muted-foreground">(required)</span> : null}</Label><Input {...props} id={id} /></div>;
}
