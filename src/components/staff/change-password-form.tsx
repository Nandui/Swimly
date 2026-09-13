"use client";
import { Notice } from "@/components/ui-kit/notice";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";

import * as React from "react";
import { toast } from "@/lib/toast";
import { Field } from "@/components/form-dialog";

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
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const error = feedback.message;
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    feedback.reset();
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
          startTransition(() => feedback.reset());
        } else {
          startTransition(() => feedback.report(result));
        }
      } catch {
        feedback.report(
          "We could not confirm the password change. Try signing in with the new password before changing it again.",
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <FormFeedbackProvider feedback={feedback}><form ref={formRef} aria-busy={pending} onSubmit={handleSubmit} className="max-w-sm">
      <div className="min-w-0 flex flex-col gap-4">
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

        {error ? <div ref={summaryRef} tabIndex={-1}><Notice title={error} tone="error" /></div> : null}

        <div className="min-w-0 flex gap-2 items-center">
          <LoadingButton
            type="submit"
            variant="default"
            pending={pending}
            aria-busy={pending}
          >
            Change password
          </LoadingButton>
        </div>
      </div>
    </form></FormFeedbackProvider>
  );
}
