"use client";

import * as React from "react";
import { Power } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Field, FormDialog } from "@/components/form-dialog";
import { Select } from "@/components/ui/select";
import { setAppSwitch } from "@/lib/apps/actions";
import type { AppSwitchState } from "@/lib/apps/switches";

type Option = { id: string; name: string };

const CHOICES: { value: AppSwitchState; label: string }[] = [
  { value: "on", label: "On everywhere" },
  { value: "sites", label: "Only at some sites" },
  { value: "off", label: "Off" },
];

/** Switch one app on everywhere, off, or on only at the ticked sites (Admin › Apps, superadmins). */
export function SwitchApp({ app, sites }: { app: { id: string; name: string; state: AppSwitchState; siteIds: string[] }; sites: Option[] }) {
  const id = React.useId();
  const [state, setState] = React.useState<AppSwitchState>(app.state);
  const [chosen, setChosen] = React.useState<string[]>(app.siteIds);
  return (
    <FormDialog
      trigger={<Button variant="outline"><Power aria-hidden={true} className="size-4 shrink-0" />Change</Button>}
      title={`Where ${app.name} is on`}
      description="Where an app is off, it leaves the menus and Home and its pages and links stop working, for everyone there. Nothing in it is deleted, and switching it back on brings it all back."
      submitLabel="Save"
      successMessage={`${app.name} saved`}
      onOpen={() => { setState(app.state); setChosen(app.siteIds); }}
      submit={() => setAppSwitch({ appId: app.id, state, siteIds: state === "sites" ? chosen : [] })}
    >
      <Field label={app.name} htmlFor={`${id}-state`}>
        <Select id={`${id}-state`} value={state} onValueChange={(value) => setState(value as AppSwitchState)} options={CHOICES} />
      </Field>
      {state === "sites" ? (
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium">On at</legend>
          {sites.map((site) => (
            <div key={site.id} className="flex items-center gap-3">
              <Checkbox
                id={`${id}-${site.id}`}
                checked={chosen.includes(site.id)}
                onCheckedChange={(checked) => setChosen((previous) => checked === true ? [...previous, site.id] : previous.filter((s) => s !== site.id))}
              />
              <Label htmlFor={`${id}-${site.id}`} className="min-h-11 flex-1 cursor-pointer">{site.name}</Label>
            </div>
          ))}
        </fieldset>
      ) : null}
    </FormDialog>
  );
}
