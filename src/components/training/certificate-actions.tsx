"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { declineCertificate, verifyCertificate } from "@/lib/training/certificate-actions";

/** Training's dialogs carry the Poolside Clear scope into their portal. */
const THEME = "turnfin-module";

type Row = { id: string; typeId: string | null; issuedOn: Date | null; expiresOn: Date | null; reference: string; person: { name: string } };
const iso = (value: Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export function VerifyCertificate({ row, types }: { row: Row; types: { id: string; name: string; validityMonths: number | null }[] }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />Record it</Button>}
      title={`Record ${row.person.name}'s certificate?`}
      description="Check the file matches what they entered. Recording it adds the qualification to their record, verified by you."
      submitLabel="Record qualification"
      successMessage="Qualification recorded"
      submit={(formData) => verifyCertificate(row.id, {
        typeId: String(formData.get("typeId") ?? ""), issuedOn: String(formData.get("issuedOn") ?? ""),
        expiresOn: String(formData.get("expiresOn") ?? ""), reference: String(formData.get("reference") ?? ""),
      })}
    >
      <Field label="Qualification" htmlFor="cert-type">
        <NativeSelect id="cert-type" name="typeId" defaultValue={row.typeId ?? ""} required className="min-h-11 w-full">
          <NativeSelectOption value="" disabled>Choose…</NativeSelectOption>
          {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Issued" htmlFor="cert-issued"><Input id="cert-issued" name="issuedOn" type="date" required defaultValue={iso(row.issuedOn)} className="min-h-11" /></Field>
      <Field label="Expires" htmlFor="cert-expires" optional hint="Leave empty to use the qualification's usual validity."><Input id="cert-expires" name="expiresOn" type="date" defaultValue={iso(row.expiresOn)} className="min-h-11" /></Field>
      <Field label="Certificate number" htmlFor="cert-ref" optional><Input id="cert-ref" name="reference" maxLength={80} defaultValue={row.reference} className="min-h-11" /></Field>
    </FormDialog>
  );
}

export function DeclineCertificate({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><X aria-hidden="true" />Decline</Button>}
      title={`Decline ${name}'s certificate?`}
      description="Nothing is recorded. They see your reason in Turnfin Me and can send a new one."
      submitLabel="Decline"
      successMessage="Certificate declined"
      submit={(formData) => declineCertificate(id, String(formData.get("note") ?? ""))}
    >
      <Field label="Why" htmlFor="cert-note" hint="For example: the photo is unreadable, or the certificate has expired.">
        <Textarea id="cert-note" name="note" rows={3} required minLength={3} maxLength={500} autoFocus />
      </Field>
    </FormDialog>
  );
}
