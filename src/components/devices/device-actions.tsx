"use client";

import { MonitorSmartphone, Unplug, XCircle } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { forgetThisDevice, registerThisDevice, revokeDevice } from "@/lib/devices/actions";

export function RegisterThisDevice({ sites }: { sites: { id: string; name: string }[] }) {
  return (
    <FormDialog
      trigger={<Button variant="default"><MonitorSmartphone aria-hidden="true" className="size-4" />Register this work device</Button>}
      title="Register this browser as a work device"
      description="For a reception computer, poolside tablet or office PC where staff work. People switch in with a PIN, and it signs out after a few idle minutes."
      submitLabel="Register device"
      successMessage="This browser is now a work device"
      submit={(formData) => registerThisDevice({ name: String(formData.get("name") ?? ""), clubId: String(formData.get("clubId") ?? "") })}
    >
      <Field label="Name" htmlFor="name" hint="Where it is, so people recognise it.">
        <Input id="name" name="name" required maxLength={60} placeholder="Churchfield reception" autoFocus />
      </Field>
      <Field label="Site" htmlFor="clubId">
        <Select id="clubId" name="clubId" defaultValue="" options={[{ value: "", label: "Not tied to a site" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
      </Field>
    </FormDialog>
  );
}

export function ForgetThisDevice() {
  return (
    <ConfirmAction
      trigger={<Button variant="outline"><Unplug aria-hidden="true" className="size-4" />Stop using this browser as a work device</Button>}
      title="Stop using this browser as a work device?"
      description="Quick switch and the short idle sign-out stop here. The device stays listed until you revoke it."
      confirmLabel="Stop using it"
      successMessage="This browser is no longer a work device"
      run={() => forgetThisDevice()}
    />
  );
}

export function RevokeDevice({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={`Revoke ${name}`}><XCircle aria-hidden="true" className="size-4" /></Button>}
      title={`Revoke ${name}?`}
      description="Quick switch stops on that device at once and its list of people is cleared. People can still sign in there with their email and password."
      confirmLabel="Revoke device"
      successMessage="Device revoked"
      run={() => revokeDevice(id)}
    />
  );
}
