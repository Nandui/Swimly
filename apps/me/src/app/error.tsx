"use client";

import Link from "next/link";
import { House, RotateCw } from "lucide-react";
import { Frame } from "@/components/frame";
import { Notice } from "@/components/ui";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

/** Something on the page broke while it was showing: try again, or start again from Home. */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Frame title="Something went wrong">
      <PageShell header={<PageHeader title="Something went wrong" />}>
        <Notice title="This page couldn't be shown" tone="error" live>Try again. If it keeps happening, go to Home and open it from there.</Notice>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => retry()}><RotateCw aria-hidden="true" />Try again</Button>
          <Button asChild variant="outline"><Link href="/"><House aria-hidden="true" />Go to Home</Link></Button>
        </div>
      </PageShell>
    </Frame>
  );
}
