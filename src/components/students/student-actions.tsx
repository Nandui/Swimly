"use client";

import { Pencil, Plus, UserRoundCheck, UserRoundX } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
// Enum *values* come from `enums`, never from `client` — that entry point
// touches node:path at module scope and does not survive a client bundle.
import { StudentStatus } from "@/generated/prisma/enums";
import {
  createStudent,
  setStudentStatus,
  updateStudent,
  type StudentInput,
} from "@/lib/students/actions/students";
import { STUDENT_STATUS_META, fullName } from "@/lib/students/constants";
import type { StudentDetail } from "@/lib/students/data/students";
import { toDateOnlyString } from "@/lib/format";

function readInput(formData: FormData): StudentInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    memberNumber: text("memberNumber"),
    firstName: text("firstName"),
    lastName: text("lastName"),
    dateOfBirth: text("dateOfBirth"),
    status: (text("status") || "ACTIVE") as StudentInput["status"],
    contactName: text("contactName"),
    contactEmail: text("contactEmail"),
    contactPhone: text("contactPhone"),
    emergencyName: text("emergencyName"),
    emergencyPhone: text("emergencyPhone"),
    emergencyRelationship: text("emergencyRelationship"),
    medicalNotes: text("medicalNotes"),
    notes: text("notes"),
    photoConsent: formData.get("photoConsent") === "on",
  };
}

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b pt-1 pb-1.5 text-[13px] font-semibold text-foreground">{children}</p>
  );
}

function StudentFields({ student }: { student?: StudentDetail }) {
  return (
    <>
      <Field
        label="Member number"
        htmlFor="memberNumber"
        hint="The club's own identifier. Leave blank for a swimmer who has not been given one."
      >
        <Input
          id="memberNumber"
          name="memberNumber"
          defaultValue={student?.memberNumber ?? ""}
          placeholder="LWB419700"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" required defaultValue={student?.firstName} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" required defaultValue={student?.lastName} />
        </Field>
        <Field label="Date of birth" htmlFor="dateOfBirth">
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={student?.dateOfBirth ? toDateOnlyString(student.dateOfBirth) : ""}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select name="status" defaultValue={student?.status ?? "ACTIVE"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(StudentStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {STUDENT_STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Legend>Contact</Legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="contactName" hint="The adult to ring. Themselves, if they are one.">
          <Input id="contactName" name="contactName" defaultValue={student?.contactName ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="contactPhone">
          <Input id="contactPhone" name="contactPhone" defaultValue={student?.contactPhone ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email" htmlFor="contactEmail">
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={student?.contactEmail ?? ""}
            />
          </Field>
        </div>
      </div>

      <Legend>In an emergency</Legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="emergencyName">
          <Input id="emergencyName" name="emergencyName" defaultValue={student?.emergencyName ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="emergencyPhone">
          <Input
            id="emergencyPhone"
            name="emergencyPhone"
            defaultValue={student?.emergencyPhone ?? ""}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Relationship" htmlFor="emergencyRelationship">
            <Input
              id="emergencyRelationship"
              name="emergencyRelationship"
              placeholder="Mother, neighbour, coach"
              defaultValue={student?.emergencyRelationship ?? ""}
            />
          </Field>
        </div>
      </div>

      <Legend>Anything the pool deck needs to know</Legend>
      <Field
        label="Medical notes"
        htmlFor="medicalNotes"
        hint="Shown as a flag on the register, with the detail one tap away. Never in a list."
      >
        <Textarea
          id="medicalNotes"
          name="medicalNotes"
          rows={3}
          defaultValue={student?.medicalNotes ?? ""}
        />
      </Field>
      <Field label="Other notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} defaultValue={student?.notes ?? ""} />
      </Field>

      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <label htmlFor="photoConsent" className="text-[13px] font-medium text-foreground">
          Photo and video consent
          <span className="block text-xs font-normal text-muted-foreground">
            Recorded with the date it was given.
          </span>
        </label>
        <Switch id="photoConsent" name="photoConsent" defaultChecked={student?.photoConsent} />
      </div>
    </>
  );
}

export function AddStudent() {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          Add swimmer
        </Button>
      }
      title="Add a swimmer"
      submitLabel="Add swimmer"
      successMessage="Swimmer added"
      width="sm:max-w-xl"
      submit={(formData) => createStudent(readInput(formData))}
    >
      <StudentFields />
    </FormDialog>
  );
}

export function EditStudent({
  student,
  variant = "icon",
}: {
  student: StudentDetail;
  variant?: "icon" | "button";
}) {
  return (
    <FormDialog
      trigger={
        variant === "icon" ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${fullName(student)}`}>
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        )
      }
      title={`Edit ${fullName(student)}`}
      submitLabel="Save changes"
      successMessage="Swimmer updated"
      width="sm:max-w-xl"
      submit={(formData) => updateStudent(student.id, readInput(formData))}
    >
      <StudentFields student={student} />
    </FormDialog>
  );
}

export function ToggleStudentStatus({
  student,
}: {
  student: { id: string; firstName: string; lastName: string; status: "ACTIVE" | "INACTIVE" };
}) {
  if (student.status === "INACTIVE") {
    return (
      <ActionButton
        ariaLabel={`Mark ${fullName(student)} active`}
        successMessage="Swimmer marked active"
        run={() => setStudentStatus(student.id, "ACTIVE")}
      >
        <UserRoundCheck className="size-3.5" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Mark ${fullName(student)} inactive`}>
          <UserRoundX className="size-3.5" />
        </Button>
      }
      title={`Mark ${fullName(student)} inactive?`}
      description="They stop appearing when someone enrols a student, and they cannot be added to a course. Their attendance, assessments and completed levels stay exactly as they are, and you can mark them active again at any time."
      confirmLabel="Mark inactive"
      successMessage="Swimmer marked inactive"
      run={() => setStudentStatus(student.id, "INACTIVE")}
    />
  );
}
