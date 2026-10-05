import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DOC_STATUS_META, documentTypeLabels, formatDate, overdue, type Group, type LibraryDocument } from '@/lib/docs/types';
import { Tag } from '@/components/ui-kit/tag';
import { DocIcon } from './ui';

/** Documents as a list of separate rounded rows (V2Docs, DCOverview): the type tile, the
 *  title over "reference · type · version · published · facilities", the status, a chevron. */
export function DocumentList({
  documents,
  facilities,
}: {
  documents: LibraryDocument[];
  facilities: Group[];
}) {
  return (
    <ul className="pc-rows">
      {documents.map((document) => {
        const c = document.content;
        const places = c.facilityIds
          .map((id) => facilities.find((facility) => facility.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        const caption = [
          c.reference,
          documentTypeLabels[c.type].one,
          document.version ? `version ${document.version}` : null,
          document.publishedAt ? formatDate(document.publishedAt) : 'Not published',
          places || 'All facilities',
        ].filter(Boolean).join(' · ');
        return (
          <li key={document.id}>
            <Link className="pc-row" href={`/docs/documents/${document.id}`}>
              <DocIcon type={c.type} />
              <span className="pc-row-body">
                <span className="pc-row-title">{c.title}</span>
                <span className="pc-row-hint">{caption}</span>
              </span>
              <span className="pc-row-trail">
                <Tag meta={DOC_STATUS_META[document.archivedAt ? 'archived' : document.version ? 'approved' : 'draft']} />
                {document.version && !document.archivedAt && overdue(c.reviewDate) && (
                  <Tag meta={DOC_STATUS_META.reviewOverdue} />
                )}
                <ChevronRight className="pc-row-chevron" aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
