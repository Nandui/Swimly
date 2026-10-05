import {
  BookOpen,
  FileCheck2,
  FileText,
  LifeBuoy,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import type { DocumentType, Member } from '@/lib/docs/types';
import { Avatar as ProfileAvatar, AvatarFallback, initials } from '@/components/shadcn/avatar';
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
/** A staff member's neutral avatar: 32px inline, `size="lg"` (40px) in rows. */
export function Avatar({
  member,
  size,
}: {
  member: Pick<Member, 'name'>;
  size?: 'default' | 'lg';
}) {
  return (
    <ProfileAvatar size={size} aria-hidden="true">
      <AvatarFallback>{initials(member.name)}</AvatarFallback>
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
