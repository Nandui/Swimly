'use client';
import { Label } from '@/components/shadcn/label';
import { Card } from '@/components/shadcn/card';
import { Input } from '@/components/shadcn/input';
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group';
import { Textarea } from '@/components/shadcn/textarea';
import { Button } from '@/components/shadcn/button';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import {
  documentTypes,
  type Workspace,
  type DocumentType,
  type DocumentContent,
} from '@/lib/docs/types';
import { createDocumentAction } from '@/app/docs/actions';
import { DocIcon, PageHeading, Message } from './ui';
const descriptions = {
  SOP: 'A clear, repeatable way to complete a task.',
  NOP: 'Everyday arrangements for running your facility.',
  EAP: 'Clear roles and actions when an emergency occurs.',
  'Risk assessment': 'Hazards, controls, and a structured risk assessment.',
  Policy: 'The principles and commitments that guide your team.',
  Custom: 'Start with a blank document and make it your own.',
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
  return (
    <div className="new-document">
      <div className="breadcrumb">
        <Link href="/docs/library">
          <ArrowLeft size={15} />
          Library
        </Link>
      </div>
      <PageHeading
        eyebrow="Give good guidance a home"
        title="Create a document"
        description="Choose a template, add the essentials, then start writing."
      />
      <ol className="create-steps" aria-label="Document creation progress">
        <li aria-current={step === 1 ? 'step' : undefined}>
          <span>1</span>Choose a template
        </li>
        <li aria-current={step === 2 ? 'step' : undefined}>
          <span>2</span>Document essentials
        </li>
        <li>
          <span>3</span>Write and review
        </li>
      </ol>
      <h2 className="create-step-heading" tabIndex={-1} ref={stepHeading}>
        {step === 1
          ? 'What kind of document are you creating?'
          : 'Give your document a clear identity'}
      </h2>
      {step === 1 && (
        <div className="create-template-layout">
          <RadioGroup
            className="template-grid"
            aria-label="Document type"
            value={type}
            onValueChange={(value) => {
              setType(value as DocumentType);
              setReference(nextRef(value as DocumentType));
            }}
          >
            {documentTypes.map((t) => (
              <Label className={`template-card ${type === t ? 'selected' : ''}`} key={t}>
                <RadioGroupItem value={t} aria-label={t} />
                <DocIcon type={t} size={24} />
                <h2>
                  {t === 'SOP'
                    ? 'Standard operating procedure'
                    : t === 'NOP'
                      ? 'Normal operating procedure'
                      : t === 'EAP'
                        ? 'Emergency action plan'
                        : t === 'Policy'
                          ? 'Policy'
                          : t === 'Custom'
                            ? 'Custom document'
                            : t}
                </h2>
                <p>{descriptions[t]}</p>
              </Label>
            ))}
          </RadioGroup>
          <Card asChild>
            <aside className="template-preview panel">
              <DocIcon type={type} size={26} />
              <h2>{selectedTemplate?.name || 'Blank document'}</h2>
              <p>{descriptions[type]}</p>
              <h3>Your starting structure</h3>
              {templateSections.length ? (
                <ol>
                  {templateSections.map((section, index) => (
                    <li key={index}>{section}</li>
                  ))}
                </ol>
              ) : (
                <p>A blank writing canvas, ready for your content.</p>
              )}
              <Button type="button" onClick={() => setStep(2)}>
                Use this template <ArrowRight size={17} aria-hidden="true" />
              </Button>
              <small>You can edit every section in the document editor.</small>
            </aside>
          </Card>
        </div>
      )}
      {step === 2 && (
        <Card asChild>
          <form
            className="panel new-document-form"
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
            <div className="create-selected-template">
              <DocIcon type={type} />
              <div>
                <strong>{selectedTemplate?.name || 'Blank document'}</strong>
                <span>Owned by {w.member.name}</span>
              </div>
              <Button variant="ghost" type="button" onClick={() => setStep(1)} disabled={busy}>
                Change template
              </Button>
            </div>
            <div className="form-grid">
              <Label>
                Document title
                <Input
                  required
                  autoComplete="off"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pool opening procedure"
                />
              </Label>
              <Label>
                Reference number
                <Input
                  required
                  maxLength={50}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Label>
            </div>
            <Label className="create-summary">
              Short summary{' '}
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                maxLength={1200}
                rows={3}
                placeholder="What will this document help someone do?"
              />
              <small>Optional. You can add or refine this while writing.</small>
            </Label>
            <Message error={error} />
            <div className="form-actions">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={busy}>
                Back
              </Button>
              <Button variant="default" className="button primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create draft and start writing'}
                <ArrowRight size={17} />
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
