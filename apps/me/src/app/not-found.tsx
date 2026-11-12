import Link from "next/link";
import { House } from "lucide-react";
import { Frame } from "@/components/frame";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

/** An address that is not a Turnfin Me page: say so, and offer Home. */
export default function NotFound() {
  return (
    <Frame title="Page not found">
      <PageShell header={<PageHeader title="Page not found" description="This page isn’t in Turnfin Me. The link may be old or mistyped." />}>
        <section className="pc-panel" aria-label="What next">
          <p>Your training, reading, shifts and everything else start from Home.</p>
          <Button asChild className="self-start max-md:self-stretch"><Link href="/"><House aria-hidden="true" />Go to Home</Link></Button>
        </section>
      </PageShell>
    </Frame>
  );
}
