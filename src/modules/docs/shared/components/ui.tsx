import {
  BookOpen,
  FileCheck2,
  FileText,
  LifeBuoy,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { useId } from 'react';
import { documentTypeLabels, type DocumentType } from '@/modules/docs/shared/types';
import type { StatusMeta } from '@/lib/status';
import { Label } from '@/components/shadcn/label';
import { NativeSelect } from '@/components/shadcn/native-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select';

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
const ALL = '__all';
/** A filter as a pill that applies on change, its name inside the trigger before the chosen
 *  value (the Refunds pickers). `''` is the "all" option, as in the URL. */
export function FilterPicker({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const chosen = options.find((option) => option.value === value)?.label ?? '';
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)} disabled={disabled}>
      <SelectTrigger aria-label={`${label}: ${chosen}`} className="max-w-full min-w-0 gap-1.5">
        <span className="text-ui-muted-foreground">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value || ALL} value={option.value || ALL}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
