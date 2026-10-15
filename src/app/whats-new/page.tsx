import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/ui-kit/page-header";
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
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        title="What's new"
        description={latest ? <>Turnfin is on version {latest.version}, updated {latest.date}. The newest changes come first.</> : "Changes to Turnfin, newest first."}
      />

      {releases.map((release, index) => (
        <section key={release.version} className="pc-panel" aria-labelledby={`release-${release.version}`}>
          <div className="pc-panel-head">
            <div className="min-w-0 flex flex-col gap-1">
              <h2 id={`release-${release.version}`} className="text-lg font-semibold">{release.title}</h2>
              <p className="pc-row-hint">Version {release.version} · {release.date}</p>
            </div>
            {index === 0 ? <Tag meta={LATEST} /> : null}
          </div>
          <div className="flex flex-col gap-3 text-sm max-w-3xl">
            {release.blocks.map((block, i) => <Block key={i} block={block} />)}
          </div>
        </section>
      ))}

      {intro.length ? (
        <section className="pc-panel" aria-labelledby="about-heading">
          <div className="pc-panel-head">
            <h2 id="about-heading" className="text-lg font-semibold">About these notes</h2>
          </div>
          <div className="flex flex-col gap-3 text-sm max-w-3xl">
            {intro.map((line, i) => <p key={i}><Rich text={line} /></p>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
