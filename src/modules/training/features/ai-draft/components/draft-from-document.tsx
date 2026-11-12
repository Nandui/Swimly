"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FormDialog } from "@/components/form-dialog";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { THEME } from "@/modules/training/shared/components/dialog-kit";

/** "Draft from a document" beside Start from a template (AI
 *  drafting): an SOP, policy or handbook page goes to the AI, and a course
 *  comes back unpublished for an author to check in the builder. */
export function DraftFromDocument({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={<Button variant="outline" className="min-h-11"><Sparkles aria-hidden="true" />Draft from a document</Button>}
      title="Draft a course from a document"
      description="Give the AI an SOP, policy or handbook section. It writes lessons, flashcards, checklists and questions from it, into a new course that stays unpublished until you’ve checked it."
      submitLabel="Write the course"
      pendingLabel="Writing the course…"
      successMessage="Course drafted. Check it before publishing."
      timeoutMs={300_000}
      submit={async (formData) => {
        if (!enabled) return { ok: false, error: "AI drafting isn’t switched on in Turnfin yet." };
        const response = await fetch("/training/courses/draft", { method: "POST", body: formData }).catch(() => null);
        const data = await response?.json().catch(() => null) as { ok: boolean; id?: string; error?: string } | null;
        if (!data?.ok || !data.id) return { ok: false, error: data?.error ?? "The AI didn’t answer. Try again." };
        router.push(`/training/courses/${data.id}`);
        return { ok: true };
      }}
    >
      {!enabled ? (
        <Notice tone="warning" title="AI drafting isn’t switched on yet">An administrator adds Turnfin’s AI key to switch it on.</Notice>
      ) : null}
      <FileField id="draft-document" name="document" label="The document" optional accept=".pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,application/pdf"
        description="A PDF, a Word document (.docx), a text file or a photo of the pages, up to 4 MB." />
      <Textarea id="draft-text" name="text" label="Or paste its text" optional rows={5} maxLength={200000} />
      <Input id="draft-title" name="title" label="Name of the new course" optional maxLength={120} description="Leave it empty and the AI suggests one." />
      <Switch id="draft-practice" name="practice" label="Practice questions after each section" defaultChecked labelSpacing="spread" />
      <Switch id="draft-exam" name="exam" label="A final exam, pass mark 80%" defaultChecked labelSpacing="spread" />
      <p className="text-sm text-ui-muted-foreground">
        Writing a course takes one to three minutes. The document goes to Anthropic’s AI, which doesn’t train on it, and Turnfin keeps only the course it writes.
        Leave out anything personal, such as names, phone numbers or medical details.
      </p>
    </FormDialog>
  );
}
