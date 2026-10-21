'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleCheck, CircleDashed, FilePlus2 } from 'lucide-react';
import { Card } from '@/components/shadcn/card';
import { Button } from '@/components/shadcn/button';
import { Notice } from '@/components/ui-kit/notice';
import { Tag } from '@/components/ui-kit/tag';
import type { StatusMeta } from '@/lib/status';
import { addHrProceduresAction } from '@/modules/docs/features/import/server/ready-made-actions';
import type { ReadyMadeItem } from '@/modules/docs/features/import/server/ready-made';

const READY_MADE_META = {
  added: { label: 'In Docs', color: 'green', icon: CircleCheck },
  missing: { label: 'Not added yet', color: 'gray', icon: CircleDashed },
} as const satisfies Record<string, StatusMeta>;

/** Docs Administration › Ready-made: adds the HR procedures as drafts in one click. */
export function ReadyMadeProcedures({ items }: { items: ReadyMadeItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ tone: 'success' | 'error'; title: string } | null>(null);
  const missing = items.filter((i) => !i.added).length;
  function add() {
    setResult(null);
    start(async () => {
      const r = await addHrProceduresAction();
      if (!r.ok) setResult({ tone: 'error', title: r.error });
      else {
        setResult({
          tone: 'success',
          title: r.data.added
            ? `${r.data.added} HR procedures added to your drafts. Find them in My work, Drafts in progress.`
            : 'The HR procedures are already in Docs.',
        });
        router.refresh();
      }
    });
  }
  return (
    <Card asChild>
      <section className="pc-panel" aria-labelledby="ready-made-heading">
        <div>
          <h2 id="ready-made-heading">HR procedures</h2>
          <p className="text-sm text-ui-muted-foreground">
            Ten short procedures for absence, sickness, lateness and leave. They are added as your drafts for every site. Fill in each part marked Set by LeisureWorld from the staff handbook, then send it for approval as usual.
          </p>
        </div>
        <div className="flex">
          <Button variant="default" disabled={pending || missing === 0} onClick={add}>
            <FilePlus2 aria-hidden="true" />
            {missing === 0 ? 'All added' : missing === items.length ? 'Add the HR procedures' : `Add the ${missing} missing`}
          </Button>
        </div>
        {result ? <Notice tone={result.tone} live={result.tone === 'error' ? 'alert' : 'status'} title={result.title} /> : null}
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.reference} className="pc-row">
              <div className="pc-row-body">
                <span className="pc-row-title">{i.title}</span>
                <span className="pc-row-hint">{i.reference}</span>
              </div>
              <Tag meta={READY_MADE_META[i.added ? 'added' : 'missing']} />
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
