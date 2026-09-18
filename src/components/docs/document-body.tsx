import type { JSONContent } from '@tiptap/react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { AlertTriangle, Info } from 'lucide-react';
import { safeUrl, riskBand } from '@/lib/docs/content';
import { formatDate, type DocumentContent, type Member } from '@/lib/docs/types';
import { Badge } from './ui';
import { Button } from '@/components/shadcn/button';
import { Table, TableBody, TableRow, TableHead, TableCell } from '@/components/shadcn/table';
import { Separator } from '@/components/shadcn/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/shadcn/collapsible';
export function tableOfContents(body: JSONContent) {
  return (body.content || []).flatMap((node, index) =>
    node.type === 'heading'
      ? [
          {
            id: `section-${index}`,
            label: (node.content || []).map((t) => t.text || '').join(''),
            level: node.attrs?.level || 2,
          },
        ]
      : [],
  );
}
function nodeView(node: JSONContent, key: string, topIndex?: number): ReactNode {
  if (node.type === 'text') {
    let result: ReactNode = node.text;
    for (const [i, mark] of (node.marks || []).entries()) {
      if (mark.type === 'bold') result = <strong key={`${key}-b${i}`}>{result}</strong>;
      if (mark.type === 'italic') result = <em key={`${key}-i${i}`}>{result}</em>;
      if (mark.type === 'underline') result = <u key={`${key}-u${i}`}>{result}</u>;
      if (mark.type === 'strike') result = <s key={`${key}-s${i}`}>{result}</s>;
      if (mark.type === 'link' && safeUrl(mark.attrs?.href || ''))
        result = (
          <a key={`${key}-l${i}`} href={mark.attrs?.href} rel="noopener noreferrer">
            {result}
          </a>
        );
    }
    return <span key={key}>{result}</span>;
  }
  const children = (node.content || []).map((child, i) => nodeView(child, `${key}-${i}`));
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{children.length ? children : <br />}</p>;
    case 'heading': {
      const id = topIndex != null ? `section-${topIndex}` : undefined;
      return node.attrs?.level === 3 ? (
        <h3 id={id} key={key}>
          {children}
        </h3>
      ) : node.attrs?.level === 4 ? (
        <h4 id={id} key={key}>
          {children}
        </h4>
      ) : (
        <h2 id={id} key={key}>
          {children}
        </h2>
      );
    }
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={Math.max(1, Number(node.attrs?.start) || 1)}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'callout':
      return (
        <aside
          className={`document-callout ${node.attrs?.kind === 'warning' ? 'warning' : 'info'}`}
          key={key}
        >
          {node.attrs?.kind === 'warning' ? <AlertTriangle size={20} /> : <Info size={20} />}
          <div>{children}</div>
        </aside>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <Separator key={key} />;
    case 'image':
      return /^\/api\/docs\/files\/[a-zA-Z0-9-]+$/.test(node.attrs?.src || '') ? (
        <figure key={key}>
          <Image src={node.attrs?.src} alt={node.attrs?.alt || ''} width={1200} height={800} unoptimized className="h-auto w-full" />
          {node.attrs?.title && <figcaption>{node.attrs.title}</figcaption>}
        </figure>
      ) : null;
    case 'table':
      return (
        <div className="table-scroll" key={key}>
          <Table>
            <TableBody>{children}</TableBody>
          </Table>
        </div>
      );
    case 'tableRow':
      return <TableRow key={key}>{children}</TableRow>;
    case 'tableHeader':
      return (
        <TableHead
          scope="col"
          key={key}
          colSpan={Math.min(20, Math.max(1, Number(node.attrs?.colspan) || 1))}
          rowSpan={Math.min(100, Math.max(1, Number(node.attrs?.rowspan) || 1))}
        >
          {children}
        </TableHead>
      );
    case 'tableCell':
      return (
        <TableCell
          key={key}
          colSpan={Math.min(20, Math.max(1, Number(node.attrs?.colspan) || 1))}
          rowSpan={Math.min(100, Math.max(1, Number(node.attrs?.rowspan) || 1))}
        >
          {children}
        </TableCell>
      );
    default:
      return <div key={key}>{children}</div>;
  }
}
export function DocumentBody({ body }: { body: JSONContent }) {
  return (
    <div className="document-prose">
      {(body.content || []).map((node, i) => nodeView(node, String(i), i))}
    </div>
  );
}
export function RiskAssessmentView({
  content,
  members,
}: {
  content: DocumentContent;
  members: Member[];
}) {
  if (content.type !== 'Risk assessment') return null;
  return (
    <section className="risk-read" id="risk-assessment">
      <h2>Risk assessment</h2>
      <p className="muted">
        Likelihood × severity. Ratings use the matrix preserved with this version.
      </p>
      {content.riskRows.map((r, index) => {
        const initial = r.initialLikelihood * r.initialSeverity;
        const residual = r.residualLikelihood * r.residualSeverity;
        const before = riskBand(content.riskMatrix, initial);
        const after = riskBand(content.riskMatrix, residual);
        return (
          <article className="risk-read-card" key={r.id}>
            <div className="risk-read-header">
              <span className="risk-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{r.hazard}</h3>
            </div>
            <div className="risk-details">
              <dl>
                <dt>People affected</dt>
                <dd>{r.people}</dd>
              </dl>
              <dl>
                <dt>Existing controls</dt>
                <dd>{r.controls}</dd>
              </dl>
              <div className="risk-scores">
                <dl>
                  <dt>Initial risk</dt>
                  <dd>
                    <Badge tone={before?.color || 'neutral'}>
                      {initial} · {before?.label || 'Unclassified'}
                    </Badge>
                    <small>
                      {r.initialLikelihood} likelihood × {r.initialSeverity} severity
                    </small>
                  </dd>
                </dl>
                <dl>
                  <dt>Residual risk</dt>
                  <dd>
                    <Badge tone={after?.color || 'neutral'}>
                      {residual} · {after?.label || 'Unclassified'}
                    </Badge>
                    <small>
                      {r.residualLikelihood} likelihood × {r.residualSeverity} severity
                    </small>
                  </dd>
                </dl>
              </div>
              {r.actions && (
                <dl>
                  <dt>Additional actions</dt>
                  <dd>
                    {r.actions}
                    <small>
                      {members.find((m) => m.id === r.ownerId)?.name || 'Unassigned'} · Due{' '}
                      {formatDate(r.dueDate)}
                    </small>
                  </dd>
                </dl>
              )}
            </div>
          </article>
        );
      })}
      {content.riskMatrix && (
        <Collapsible className="matrix-details">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-auto whitespace-normal text-left">
              View the scoring definitions for this version
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className="matrix-disclosure">
            <div className="matrix-definitions">
              <div>
                <h3>Likelihood</h3>
                {content.riskMatrix.likelihood.map((v, i) => (
                  <p key={i}>
                    <strong>
                      {i + 1}. {v.label}
                    </strong>
                    <br />
                    {v.description}
                  </p>
                ))}
              </div>
              <div>
                <h3>Severity</h3>
                {content.riskMatrix.severity.map((v, i) => (
                  <p key={i}>
                    <strong>
                      {i + 1}. {v.label}
                    </strong>
                    <br />
                    {v.description}
                  </p>
                ))}
              </div>
            </div>
            <div className="risk-band-key">
              {content.riskMatrix.bands.map((b) => (
                <Badge tone={b.color} key={b.label}>
                  {b.min}–{b.max}: {b.label}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
