import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag, type TagMeta } from "@/components/ui-kit/tag";
import { boldRuns, releaseNotes, type ReleaseBlock } from "@/lib/whats-new";

export const metadata: Metadata = { title: "What's new" };

const LATEST: TagMeta = { label: "Latest", color: "blue", icon: Sparkles };

function Rich({ text }: { text: string }) {
  return boldRuns(text).map((run, i) => (run.bold ? <strong key={i} className="font-semibold">{run.text}</strong> : <span key={i}>{run.text}</span>));
}

function Block({ block }: { block: ReleaseBlock }) {
  if (block.kind === "heading") return <h3 className="text-base font-semibold">{block.text}</h3>;
  if (block.kind === "text") return <p><Rich text={block.text} /></p>;
  return (
    <ul className="flex flex-col gap-2 list-disc pl-5">
      {block.items.map((item, i) => <li key={i}><Rich text={item} /></li>)}
    </ul>
  );
}

/** Every release in CHANGELOG.md, newest first, in the words staff read them in. */
export default async function WhatsNewPage() {
  const { intro, releases } = await releaseNotes();
  const latest = releases[0];
  return (
    <PageShell spacing="roomy" header={<PageHeader
        title="What's new"
        description={latest ? <>Turnfin is on version {latest.version}, updated {latest.date}. The newest changes come first.</> : "Changes to Turnfin, newest first."}
      />}>

      {releases.map((release, index) => (
        <RecordSection key={release.version} id={`release-${release.version}`} title={release.title}
          aside={index === 0 ? <Tag meta={LATEST} /> : null} note={`Version ${release.version} · ${release.date}`}>
          <div className="rec-card">
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              {release.blocks.map((block, i) => <Block key={i} block={block} />)}
            </div>
          </div>
        </RecordSection>
      ))}

      {intro.length ? (
        <RecordSection id="about-heading" title="About these notes">
          <div className="rec-card">
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              {intro.map((line, i) => <p key={i}><Rich text={line} /></p>)}
            </div>
          </div>
        </RecordSection>
      ) : null}
    </PageShell>
  );
}
