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
  LifeBuoy,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { canWrite, type DocumentType, type Workspace } from '@/lib/docs/types';
import { DocIcon, EmptyState } from './ui';
import { Button } from '@/components/shadcn/button';
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
  const documents = w.documents.filter(
    (d) => d.currentVersionId && matchesFacility(d.content.facilityIds),
  );
  const facilityQuery = facility ? `facility=${encodeURIComponent(facility)}` : '';
  const libraryUrl = `/docs/library${facilityQuery ? `?${facilityQuery}` : ''}`;

  return (
    <div className="knowledge-home home-operational">
      <header className="home-heading">
        <div>
          <h1>Docs</h1>
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
                <h2 id="required-reading-title">Your required reading</h2>
              </div>
            </div>
            {/* Personal records live in Turnfin Me, the staff app, never on Work. */}
            <EmptyState
              title="Read and acknowledge in Turnfin Me"
              description="Documents assigned to you, their deadlines and your acknowledgements are in Turnfin Me on your phone. The library here is open for looking things up at work."
            />
            <div className="reading-panel-footer">
              <span>
                <ShieldCheck size={15} aria-hidden="true" /> Every acknowledgement is recorded.
              </span>
              <Link href={libraryUrl} className="text-link">
                Browse the library <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </Card>

        <aside className="home-side">
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
            <Link href={libraryUrl}>
              <span>
                <strong>Browse the library</strong>
                <small>Every published document for your facility</small>
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
