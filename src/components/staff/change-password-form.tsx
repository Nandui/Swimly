"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { Field } from "@/components/form-dialog";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { HStack } from "@astryxdesign/core/Stack";
import { Input } from "@/components/ui/input";
import { changeOwnPassword } from "@/lib/staff/actions/account";
import { MIN_PASSWORD_LENGTH } from "@/lib/staff/constants";

/** A page form rather than a dialog, because it is the whole reason the page
 *  exists. The failure behaviour still matches `FormDialog`: the sentence
 *  lands beside the fields and the typing survives; only success gets a toast.
 *
 *  The form is reset on success rather than left populated — the fields hold a
 *  password that is now the live one, and there is no reason for it to sit in
 *  the DOM afterwards. */
export function ChangePasswordForm() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await changeOwnPassword({
          current: String(formData.get("current") ?? ""),
          next: String(formData.get("next") ?? ""),
          confirm: String(formData.get("confirm") ?? ""),
        });

        if (result.ok) {
          toast.success("Password changed");
          formRef.current?.reset();
          startTransition(() => setError(null));
        } else {
          startTransition(() => setError(result.error));
        }
      } catch {
        setError(
          "We could not confirm the password change. Try signing in with the new password before changing it again."
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-sm">
      <FormLayout>
        <Field label="Current password" htmlFor="current">
          <Input
            id="current"
            name="current"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>

        <Field
          label="New password"
          htmlFor="next"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        >
          <Input
            id="next"
            name="next"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </Field>

        <Field label="New password again" htmlFor="confirm">
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </Field>

        {error ? <Banner status="error" title={error} collapsible={false} /> : null}

        <HStack>
          <Button
            label={pending ? "Saving…" : "Change password"}
            variant="primary"
            type="submit"
            isLoading={pending}
          />
        </HStack>
      </FormLayout>
    </form>
  );
}
