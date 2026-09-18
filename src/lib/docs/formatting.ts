import type { JSONContent } from '@tiptap/react';

/** Shared by authoring, validation and the read-only document renderer. */
export const headingLevels = [1, 2, 3, 4, 5, 6] as const;
export const textAlignments = ['left', 'center', 'right', 'justify'] as const;
export const fontSizes = [12, 14, 16, 18, 20, 24, 30, 36, 48];
export const textColours = [
  { name: 'Blue', value: '#2563eb', dark: '#93c5fd' }, { name: 'Teal', value: '#0f766e', dark: '#5eead4' },
  { name: 'Green', value: '#15803d', dark: '#86efac' }, { name: 'Purple', value: '#9333ea', dark: '#d8b4fe' },
  { name: 'Red', value: '#dc2626', dark: '#fca5a5' }, { name: 'Orange', value: '#c2410c', dark: '#fdba74' },
];
export const highlightColours = [
  { name: 'Yellow', value: '#fef08a' }, { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' }, { name: 'Pink', value: '#fbcfe8' },
  { name: 'Purple', value: '#e9d5ff' }, { name: 'Orange', value: '#fed7aa' },
];

// Do not allow arbitrary CSS in saved documents. RGB covers browser-normalised paste.
export function safeColour(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return true;
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value);
  return Boolean(rgb && rgb.slice(1).every(channel => Number(channel) <= 255));
}
export function safeFontSize(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const size = /^(\d+(?:\.\d+)?)(px|pt)$/.exec(value);
  return Boolean(size && Number(size[1]) >= 8 && Number(size[1]) <= (size[2] === 'pt' ? 72 : 96));
}
export function safeAlignment(value: unknown): value is typeof textAlignments[number] {
  return textAlignments.includes(value as typeof textAlignments[number]);
}

export function readableColour(value: string) {
  const colour = textColours.find(colour => colour.value === value.toLowerCase() ||
    `rgb(${[1, 3, 5].map(index => parseInt(colour.value.slice(index, index + 2), 16)).join(',')})` === value.replace(/\s/g, '').toLowerCase());
  return colour ? `light-dark(${colour.value}, ${colour.dark})` : value;
}

export function documentWordCount(body: JSONContent): number {
  const text = (node: JSONContent): string => {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return ' ';
    const children = (node.content || []).map(text).join('');
    return ['paragraph', 'heading', 'codeBlock'].includes(node.type || '') ? `${children} ` : children;
  };
  return text(body).trim().split(/\s+/).filter(Boolean).length;
}
