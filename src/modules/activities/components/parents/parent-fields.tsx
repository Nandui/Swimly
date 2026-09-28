"use client";

import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { FormDialog } from "@/components/form-dialog";

export function ParentFormDialog(props: React.ComponentProps<typeof FormDialog>) {
  return <FormDialog {...props} width="sm:max-w-md [&_button]:min-h-11 [&_input]:min-h-11 [&_[data-slot=dialog-close]]:min-w-11 [&_[data-slot=dialog-close]]:top-2 [&_[data-slot=dialog-close]]:right-2" />;
}

export function ParentReason() {
  return <Textarea name="reason" label="Reason" required minLength={3} maxLength={500}
    description="Saved in the activity log with your name." />;
}

export function ParentLoadState({ loading, error, reload }: { loading: boolean; error?: string; reload: () => void }) {
  if (error) return <Notice tone="error" title={error} actions={<Button variant="outline" className="min-h-11" onClick={reload}>Try again</Button>} />;
  return loading ? <p role="status" className="py-4 text-sm text-ui-muted-foreground">Loading…</p> : null;
}
