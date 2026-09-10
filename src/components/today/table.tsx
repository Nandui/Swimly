// Adapted from shadcn/ui's MIT-licensed new-york-v4 Table registry.
// https://ui.shadcn.com/r/styles/new-york-v4/table.json
// Scoped to Today by calendar.module.css; colour and spacing follow Swimly's theme.
import type { ComponentProps } from 'react';

export function Table(props: ComponentProps<'table'>) {
  return <table data-slot="table" {...props} />;
}
export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" {...props} />;
}
export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" {...props} />;
}
export function TableRow(props: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" {...props} />;
}
export function TableHead(props: ComponentProps<'th'>) {
  return <th data-slot="table-head" {...props} />;
}
export function TableCell(props: ComponentProps<'td'>) {
  return <td data-slot="table-cell" {...props} />;
}
