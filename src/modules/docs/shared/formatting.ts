import type { JSONContent } from '@tiptap/react';

/** Shared by authoring, validation and the read-only document renderer. */
export const headingLevels = [1, 2, 3, 4, 5, 6] as const;
export const textAlignments = ['left', 'center', 'right', 'justify'] as const;
export const fontSizes = [12, 14, 16, 18, 20, 24, 30, 36, 48];
/** The stored values; each is drawn through its `--pc-docs-*` token (poolside.css), lighter in dark mode. */
export const textColours = [
  { name: 'Blue', value: '#2563eb' }, { name: 'Teal', value: '#0f766e' },
  { name: 'Green', value: '#15803d' }, { name: 'Purple', value: '#9333ea' },
  { name: 'Red', value: '#dc2626' }, { name: 'Orange', value: '#c2410c' },
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

const channels = (value: string): number[] | null => {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  }
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value);
  return rgb ? rgb.slice(1).map(Number) : null;
};
const nearest = (value: string, palette: { name: string; value: string }[]) => {
  const want = channels(value);
  if (!want) return undefined;
  let best = palette[0], gap = Infinity;
  for (const colour of palette) {
    const has = channels(colour.value)!;
    const d = has.reduce((n, c, i) => n + (c - want[i]) ** 2, 0);
    if (d < gap) { best = colour; gap = d; }
  }
  return best.name.toLowerCase();
};
/** A stored colour drawn as the nearest colour of the Docs palette (`data-colour`, themed in
 *  poolside.css), since pages never carry inline styles; the stored value itself is kept. */
export const textColourKey = (value: unknown) => safeColour(value) ? nearest(value, textColours) : undefined;
export const highlightKey = (value: unknown) => safeColour(value) ? nearest(value, highlightColours) : undefined;
/** A stored size drawn as the nearest size of the editor's list (`data-size`, editor.css). */
export function fontSizeKey(value: unknown) {
  if (!safeFontSize(value)) return undefined;
  const [, n, unit] = /^(\d+(?:\.\d+)?)(px|pt)$/.exec(value)!;
  const px = unit === 'pt' ? Number(n) * 4 / 3 : Number(n);
  return String(fontSizes.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a));
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
