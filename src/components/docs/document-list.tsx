import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { formatDate, overdue, type Group, type LibraryDocument } from '@/lib/docs/types';
import { Badge, DocIcon } from './ui';

export function DocumentList({
  documents,
  facilities,
}: {
  documents: LibraryDocument[];
  facilities: Group[];
}) {
  return (
    <div className="knowledge-list">
      <div className="knowledge-list-labels" aria-hidden="true">
        <span>Document</span>
        <span>Facility</span>
        <span>Published</span>
        <span>Status</span>
      </div>
      <ul>
        {documents.map((document) => (
          <li key={document.id}>
            <Link className="knowledge-row" href={`/docs/documents/${document.id}`}>
              <div className="knowledge-title">
                <DocIcon type={document.content.type} />
                <div>
                  <strong>{document.content.title}</strong>
                  <span>
                    {document.content.reference} · {document.content.type}
                    {document.version ? ` · v${document.version}` : ''}
                  </span>
                </div>
              </div>
              <span className="knowledge-facility">
                {document.content.facilityIds
                  .map((id) => facilities.find((facility) => facility.id === id)?.name)
                  .filter(Boolean)
                  .join(', ') || 'All facilities'}
              </span>
              <span className="knowledge-date">
                {document.publishedAt ? formatDate(document.publishedAt) : 'Not published'}
              </span>
              <div className="knowledge-status">
                <Badge
                  tone={document.archivedAt ? 'neutral' : document.version ? 'green' : 'amber'}
                >
                  {document.archivedAt ? 'Archived' : document.version ? 'Approved' : 'Draft'}
                </Badge>
                {document.version &&
                  !document.archivedAt &&
                  overdue(document.content.reviewDate) && (
                    <span className="knowledge-overdue">Review overdue</span>
                  )}
              </div>
              <ArrowUpRight size={17} className="knowledge-arrow" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
