import type { Metadata } from "next";
import { cache } from "react";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ArchiveTemplate, CopyTemplate } from "@/components/tasks/template-actions";
import { TemplateEditor } from "@/components/tasks/template-editor";
import { plural, today } from "@/lib/format";
import { taskTemplate } from "@/lib/tasks/data";
import { TEMPLATE_STATUS_META } from "@/lib/tasks/rules";

/** One read per request, shared by the page and its tab title. */
const load = cache(taskTemplate);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: (await load((await params).id)).template?.title || "Template" };
}

/** One template to change, copy or archive. An archived one is restored before it changes. */
export default async function TaskTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { template, sites, roles } = await load((await params).id);
  const t = template!;
  return (
    <>
      <PageHeader back={{ href: "/tasks/templates", label: "Templates" }} title={t.title || "Untitled template"}
        description={t.used ? `It has made ${plural(t.used, "task")}. Changes apply to the tasks it makes from now on.` : "It has not made a task yet."}
        status={<Tag meta={TEMPLATE_STATUS_META[t.status]} />}
        actions={<><CopyTemplate id={t.id} /><ArchiveTemplate id={t.id} archived={t.status === "archived"} /></>} />
      {t.status === "archived" ? (
        <Notice tone="info" title="Archived" description="It makes no more tasks. Restore it as a draft to change it." />
      ) : (
        <TemplateEditor key={t.version} sites={sites} roles={roles} today={today()} template={t} />
      )}
    </>
  );
}
