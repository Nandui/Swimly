import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TemplateEditor } from "@/modules/tasks/components/template-editor";
import { today } from "@/lib/format";
import { taskTemplate } from "@/modules/tasks/lib/data";

export const metadata: Metadata = { title: "New template" };

export default async function NewTaskTemplatePage() {
  const { sites, roles } = await taskTemplate(null);
  const day = today();
  return (
    <>
      <PageHeader back={{ href: "/tasks/templates", label: "Templates" }} title="New template" description="Save it as a draft while you write it; publishing starts its schedule." />
      <TemplateEditor sites={sites} roles={roles} today={day} template={{
        id: null, version: null, status: "draft", title: "", description: "", kind: "repeat", siteIds: [], roleIds: [], restricted: false, tags: [], priority: false,
        checklist: [], fields: [], minimumRecords: 1, logMode: "form",
        schedules: [{ id: crypto.randomUUID().slice(0, 8), repeat: "daily", every: 1, weekdays: [1, 2, 3, 4, 5], from: day, start: "open", due: "09:00" }],
        requiresComment: false, requiresApproval: false, notifyCompletion: false, notifyException: false,
      }} />
    </>
  );
}
