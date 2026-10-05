import {
  BookOpen,
  FileCheck2,
  FileText,
  LifeBuoy,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { useId } from 'react';
import { documentTypeLabels, type DocumentType, type Member } from '@/lib/docs/types';
import type { StatusMeta } from '@/lib/status';
import { Avatar as ProfileAvatar, AvatarFallback, initials } from '@/components/shadcn/avatar';
import { Label } from '@/components/shadcn/label';
import { NativeSelect } from '@/components/shadcn/native-select';

/** A labelled pill select in a Docs filter row (library, My work, reports): the label sits
 *  above the 44px pill, and the pair takes a share of the row. */
export function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? 'grow basis-48 sm:grow-0'}`}>
      <Label className="block" htmlFor={id}>{label}</Label>
      <NativeSelect id={id} className="w-full" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </NativeSelect>
    </div>
  );
}
export const typeIcons = {
  SOP: FileCheck2,
  NOP: BookOpen,
  EAP: LifeBuoy,
  'Risk assessment': ClipboardList,
  Policy: ShieldCheck,
  Custom: FileText,
};
/** A document's type as a tag: its full name and its icon, always neutral (a type is not a status). */
export function docTypeMeta(type: DocumentType): StatusMeta {
  return { label: documentTypeLabels[type].long, color: 'gray', icon: typeIcons[type] || FileText };
}
/** A document's type as the one neutral 40px icon tile (colour only ever means status). */
export function DocIcon({ type }: { type: DocumentType }) {
  const Icon = typeIcons[type] || FileText;
  return (
    <span className="pc-tile-icon">
      <Icon aria-hidden="true" />
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
