'use client';

import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Input } from '@/components/shadcn/input';
import { Card } from '@/components/shadcn/card';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  LifeBuoy,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { formatDate, overdue, canWrite, type DocumentType, type Workspace } from '@/lib/docs/types';
import { Badge, DocIcon, EmptyState } from './ui';
import { Button } from '@/components/shadcn/button';
import { Progress } from '@/components/shadcn/progress';
import { DocumentList } from './document-list';

const collections: { type: DocumentType; label: string; description: string }[] = [
  { type: 'SOP', label: 'Procedures', description: 'The everyday essentials' },
  { type: 'NOP', label: 'Operations', description: 'Keep things running well' },
  { type: 'Policy', label: 'Policies', description: 'A shared way of working' },
  { type: 'Risk assessment', label: 'Risk assessments', description: 'Understand and manage risk' },
];

export function HomeView({ workspace: w }: { workspace: Workspace }) {
  const [facility, setFacility] = useState('');
  const matchesFacility = (ids: string[]) => !facility || !ids.length || ids.includes(facility);
  const reading = w.requirements.filter(
    (r) => r.status !== 'cancelled' && matchesFacility(r.facilityIds),
  );
  const outstanding = reading
    .filter((r) => r.status === 'outstanding')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const documents = w.documents.filter(
    (d) => d.currentVersionId && matchesFacility(d.content.facilityIds),
  );
  const completed = reading.filter((r) => r.status === 'completed').length;
  const progress = reading.length ? Math.round((completed / reading.length) * 100) : 0;
  const facilityQuery = facility ? `facility=${encodeURIComponent(facility)}` : '';
  const libraryUrl = `/docs/library${facilityQuery ? `?${facilityQuery}` : ''}`;

  return (
    <div className="knowledge-home home-operational">
      <header className="home-heading">
        <div>
          <p className="section-kicker">Turnfin Docs</p>
          <h1>Your workspace</h1>
          <p className="muted">
            Welcome back, {w.member.name.split(' ')[0]}. Here’s what needs your attention.
          </p>
        </div>
        <Label className="home-facility">
          <MapPin size={16} aria-hidden="true" />
          <span className="sr-only">Filter by facility</span>
          <NativeSelect value={facility} onChange={(event) => setFacility(event.target.value)}>
            <NativeSelectOption value="">All facilities</NativeSelectOption>
            {w.facilities.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </header>

      <form className="home-search" action="/docs/library" role="search" aria-label="Find guidance">
        <Search size={22} aria-hidden="true" />
        <Input
          type="search"
          name="q"
          aria-label="Search your team’s knowledge"
          placeholder="Find a procedure, policy or document…"
        />
        {facility && <input type="hidden" name="facility" value={facility} />}
        <Button type="submit">
          Search <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </form>
      <section className="emergency-banner" aria-label="Emergency plans">
        <LifeBuoy size={25} aria-hidden="true" />
        <div>
          <strong>Emergency plans</strong>
          <span>Approved responses for your facility.</span>
        </div>
        <Link href={`/docs/library?type=EAP${facilityQuery ? `&${facilityQuery}` : ''}`}>
          Open plans <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <div className="home-focus-grid">
        <Card asChild>
          <section className="reading-panel" aria-labelledby="required-reading-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Your next steps</p>
                <h2 id="required-reading-title">Your required reading</h2>
              </div>
              <span className="count-tag">{outstanding.length} to read</span>
            </div>
            {outstanding.length ? (
              <ul className="home-reading-list">
                {outstanding.slice(0, 3).map((requirement, index) => (
                  <li key={requirement.id}>
                    <Link
                      href={`/docs/documents/${requirement.documentId}?version=${requirement.versionId}`}
                      className="home-reading-row"
                    >
                      <span className="reading-index" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="home-reading-title">
                        <strong>{requirement.title}</strong>
                        <span>
                          {requirement.reference} · Version {requirement.version}
                          {requirement.dueDate
                            ? ` · Due ${formatDate(requirement.dueDate)}`
                            : ' · No deadline'}
                        </span>
                      </div>
                      {overdue(requirement.dueDate) ? (
                        <Badge tone="red">Overdue</Badge>
                      ) : (
                        <ArrowRight size={18} aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={reading.length ? 'You’re all caught up' : 'No reading assigned'}
                description={
                  reading.length
                    ? 'You have read every document assigned to you for this facility.'
                    : 'When documents are assigned to you, you’ll find them here.'
                }
              />
            )}
            <div className="reading-panel-footer">
              <span>
                <ShieldCheck size={15} aria-hidden="true" /> Every acknowledgement is recorded.
              </span>
              <Link
                href={`/docs/work?view=reading${facilityQuery ? `&${facilityQuery}` : ''}`}
                className="text-link"
              >
                View reading queue <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </Card>

        <aside className="home-side">
          <Card asChild>
            <section className="reading-progress" aria-label="Your reading progress">
              <div>
                <span>
                  <CheckCircle2 size={17} aria-hidden="true" /> Your reading progress
                </span>
                <strong>{reading.length ? `${progress}%` : '—'}</strong>
              </div>
              <Progress
                value={progress}
                aria-label={`${completed} of ${reading.length} assigned documents read`}
              />
              <p>
                {reading.length
                  ? `${completed} of ${reading.length} assigned documents read`
                  : 'No documents assigned for this facility'}
              </p>
            </section>
          </Card>
          <nav className="home-work-links" aria-label="Workspace actions">
            {canWrite(w.member) && (
              <>
                <Link href="/docs/work?view=drafts">
                  <span>
                    <strong>Continue a draft</strong>
                    <small>Pick up where the team left off</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link href="/docs/work?view=reviews">
                  <span>
                    <strong>Review submissions</strong>
                    <small>Decisions waiting for you</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </>
            )}
            <Link href={`/docs/work?view=completed${facilityQuery ? `&${facilityQuery}` : ''}`}>
              <span>
                <strong>Completed reading</strong>
                <small>Your acknowledgements by version</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </nav>
        </aside>
      </div>

      <nav className="collection-grid" aria-label="Browse document collections">
        {collections.map(({ type, label, description }) => (
          <Link
            className="collection-link"
            key={type}
            href={`/docs/library?type=${encodeURIComponent(type)}${facilityQuery ? `&${facilityQuery}` : ''}`}
          >
            <div className="collection-top">
              <DocIcon type={type} />
              <span>{documents.filter((d) => d.content.type === type).length}</span>
            </div>
            <strong>
              {label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </strong>
            <p>{description}</p>
          </Link>
        ))}
      </nav>

      <section className="recent-section" aria-labelledby="recent-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Keep in the know</p>
            <h2 id="recent-heading">Recently published</h2>
          </div>
          <Link className="text-link" href={libraryUrl}>
            View all documents <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {documents.length ? (
          <DocumentList documents={documents.slice(0, 5)} facilities={w.facilities} />
        ) : (
          <Card asChild>
            <div className="panel">
              <EmptyState
                title="No publications yet"
                description="Approved documents for this facility will appear here once published."
                href="/docs/library"
                label="Explore the library"
              />
            </div>
          </Card>
        )}
      </section>
      <p className="home-assurance">
        <Check size={15} aria-hidden="true" /> Approved guidance, so everyone’s on the same page.
      </p>
    </div>
  );
}
