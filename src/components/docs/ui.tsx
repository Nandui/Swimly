import { Button } from '@/components/shadcn/button';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  FileCheck2,
  FileText,
  LifeBuoy,
  ShieldCheck,
  ClipboardList,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { DocumentType, Member } from '@/lib/docs/types';
import { Badge as StatusBadge } from '@/components/shadcn/badge';
import { Avatar as ProfileAvatar, AvatarFallback } from '@/components/shadcn/avatar';
import { Alert, AlertDescription } from '@/components/shadcn/alert';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/shadcn/empty';
export const typeIcons = {
  SOP: FileCheck2,
  NOP: BookOpen,
  EAP: LifeBuoy,
  'Risk assessment': ClipboardList,
  Policy: ShieldCheck,
  Custom: FileText,
};
export function DocIcon({ type, size = 20 }: { type: DocumentType; size?: number }) {
  const Icon = typeIcons[type] || FileText;
  return (
    <span className={`doc-icon type-${type.toLowerCase().replaceAll(' ', '-')}`}>
      <Icon size={size} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <StatusBadge
      variant="secondary"
      className={`badge ${tone}`}
      data-tone={tone === 'amber' ? 'yellow' : tone}
    >
      {children}
    </StatusBadge>
  );
}
export function Avatar({
  member,
  small = false,
}: {
  member: Pick<Member, 'name'>;
  small?: boolean;
}) {
  return (
    <ProfileAvatar className={`avatar${small ? ' small' : ''}`} aria-hidden="true">
      <AvatarFallback className="bg-ui-brand-soft text-ui-brand-ink">
        {member.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')}
      </AvatarFallback>
    </ProfileAvatar>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  href,
  label,
  headingLevel = 3,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia>
          <BookOpen size={30} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{title}</Heading>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {href && (
        <Button asChild variant="outline">
          <Link className="button secondary" href={href}>
            {label}
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      )}
    </Empty>
  );
}
export function Message({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <Alert
      variant={error ? 'destructive' : 'default'}
      className={`notice ${error ? 'error' : 'success'}`}
      role={error ? 'alert' : 'status'}
    >
      {error ? <AlertCircle size={18} /> : <Check size={18} />}
      <AlertDescription className="text-inherit">{error || success}</AlertDescription>
    </Alert>
  );
}
