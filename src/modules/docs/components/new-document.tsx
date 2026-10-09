'use client';
import { Label } from '@/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group';
import { Button } from '@/components/shadcn/button';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui-kit/page-header';
import { Input as FieldInput } from '@/components/ui/input';
import { Textarea as FieldTextarea } from '@/components/ui/textarea';
import {
  documentTypes,
  documentTypeLabels,
  type Workspace,
  type DocumentType,
  type DocumentContent,
} from '@/modules/docs/lib/types';
import { createDocumentAction } from '@/app/docs/actions';
import { DocIcon } from './ui';
import { Notice } from '@/components/ui-kit/notice';
const descriptions = {
  SOP: 'A clear, repeatable way to complete a task',
  NOP: 'Everyday arrangements for running your facility',
  EAP: 'Roles and actions when something goes wrong',
  'Risk assessment': 'Hazards, who is affected and the controls',
  Policy: 'The principles that guide your team',
  Custom: 'Start from a blank page',
};
export function NewDocument({ workspace: w }: { workspace: Workspace }) {
  const router = useRouter();
  const [type, setType] = useState<DocumentType>('SOP');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [step, setStep] = useState(1);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeading.current?.focus();
  }, [step]);
  const selectedTemplate = w.templates.find((template) => template.type === type);
  const templateSections =
    selectedTemplate?.body.content
      ?.filter((node) => node.type === 'heading')
      .map((node) => node.content?.map((child) => child.text || '').join('')) || [];
  const nextRef = (t: DocumentType) =>
    `${t === 'Risk assessment' ? 'RA' : t === 'Policy' ? 'POL' : t === 'Custom' ? 'DOC' : t}-${String(Math.max(0, ...w.documents.filter((d) => d.content.type === t).map((d) => Number(d.content.reference.split('-').pop()) || 0)) + 1).padStart(3, '0')}`;
  const [reference, setReference] = useState(nextRef('SOP'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const steps = ['Choose a template', 'Document essentials', 'Write and review'];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        back={{ href: '/docs/library', label: 'Document library' }}
        title="Create a document"
        description="Choose a template, add the essentials, then start writing"
      />
      <ol className="create-steps" aria-label="Document creation progress">
        {steps.map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
            <span className="create-step-of">Step {index + 1} of 3 · </span>
            <span className="create-step-number" aria-hidden="true">{index + 1}.{' '}</span>
            {label}
          </li>
        ))}
      </ol>
      {step === 1 && (
        <div className="editor-columns">
          <section className="pc-panel min-w-0" aria-labelledby="template-heading">
            <h2 id="template-heading" tabIndex={-1} ref={stepHeading}>
              What kind of document are you creating?
            </h2>
            <RadioGroup
              className="pc-rows pc-rows-grid"
              aria-labelledby="template-heading"
              value={type}
              onValueChange={(value) => {
                setType(value as DocumentType);
                setReference(nextRef(value as DocumentType));
              }}
            >
              {documentTypes.map((t) => (
                <Label className="pc-row template-choice" key={t}>
                  <RadioGroupItem value={t} className="sr-only" aria-describedby={`template-${t.replace(' ', '-')}`} />
                  <DocIcon type={t} />
                  <span className="pc-row-body">
                    <span className="pc-row-title">{documentTypeLabels[t].long}</span>
                    <span className="pc-row-hint" id={`template-${t.replace(' ', '-')}`}>{descriptions[t]}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </section>
          <aside className="pc-panel min-w-0" aria-labelledby="preview-heading">
            <div>
              <h2 id="preview-heading">{selectedTemplate?.name || 'Blank document'}</h2>
              <p className="text-sm text-ui-muted-foreground">{descriptions[type]}</p>
            </div>
            <h3 className="text-xs text-ui-muted-foreground">Your starting structure</h3>
            {templateSections.length ? (
              <ol className="pc-rows">
                {templateSections.map((section, index) => (
                  <li key={index} className="pc-row min-h-0 py-2">
                    <span className="pc-tile-icon size-8 text-xs font-semibold">{index + 1}</span>
                    <span className="pc-row-body">{section}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ui-muted-foreground">A blank page, ready for your content</p>
            )}
            <Button type="button" onClick={() => setStep(2)}>
              Use this template
              <ChevronRight aria-hidden="true" />
            </Button>
            <p className="text-xs text-ui-muted-foreground">You can edit every section in the document editor</p>
          </aside>
        </div>
      )}
      {step === 2 && (
          <form
            className="pc-panel"
            aria-labelledby="essentials-heading"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const template = w.templates.find((t) => t.type === type);
              const c: DocumentContent = {
                schemaVersion: 1,
                title,
                reference,
                type,
                summary: '',
                ownerId: w.member.id,
                facilityIds: [...w.member.facilityIds],
                teamIds: [...w.member.teamIds],
                reviewDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
                body: structuredClone(
                  template?.body || { type: 'doc', content: [{ type: 'paragraph' }] },
                ),
                riskRows: [],
                riskMatrix: type === 'Risk assessment' ? w.matrix : null,
                relatedIds: [],
                attachments: [],
              };
              try {
                const result = await createDocumentAction({ ...c, summary });
                if (result.ok) router.push(`/docs/documents/${result.data}/edit`);
                else {
                  setError(result.error);
                  setBusy(false);
                }
              } catch {
                setError(
                  'Could not create the draft. Your details are still here; please try again.',
                );
                setBusy(false);
              }
            }}
          >
            <h2 id="essentials-heading" tabIndex={-1} ref={stepHeading}>
              Give your document a clear identity
            </h2>
            <div className="pc-row">
              <DocIcon type={type} />
              <span className="pc-row-body">
                <span className="pc-row-title">{selectedTemplate?.name || 'Blank document'}</span>
                <span className="pc-row-hint">{documentTypeLabels[type].long} · Owned by {w.member.name}</span>
              </span>
              <Button variant="outline" type="button" onClick={() => setStep(1)} disabled={busy}>
                Change template
              </Button>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <FieldInput
                label="Document title"
                required
                autoComplete="off"
                maxLength={200}
                value={title}
                onChange={setTitle}
                placeholder="Pool opening procedure"
              />
              <FieldInput
                label="Reference number"
                required
                maxLength={50}
                value={reference}
                onChange={setReference}
              />
            </div>
            <FieldTextarea
              label="Short summary"
              optional
              description="You can add or refine this while writing"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={1200}
              rows={3}
              placeholder="What will this document help someone do?"
            />
            {error ? <Notice tone="error" live="alert" title={error} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={busy}>
                Back
              </Button>
              <Button disabled={busy}>
                {busy ? 'Creating…' : 'Create draft and start writing'}
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </form>
      )}
    </div>
  );
}
