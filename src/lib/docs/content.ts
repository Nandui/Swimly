import { z } from 'zod';
import type { JSONContent } from '@tiptap/react';
import { documentTypes, type DocumentContent, type RiskMatrix } from './types';
import { headingLevels, safeAlignment, safeColour, safeFontSize } from './formatting';

const date = z
  .string()
  .refine(
    (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
    'Use a valid date',
  );
const ids = z.array(z.string().min(1).max(100)).max(100);
export const matrixSchema = z
  .object({
    configured: z.boolean(),
    likelihood: z
      .array(
        z.object({ label: z.string().min(1).max(80), description: z.string().min(1).max(500) }),
      )
      .length(5),
    severity: z
      .array(
        z.object({ label: z.string().min(1).max(80), description: z.string().min(1).max(500) }),
      )
      .length(5),
    bands: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          min: z.number().int().min(1).max(25),
          max: z.number().int().min(1).max(25),
          color: z.enum(['green', 'amber', 'orange', 'red']),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine(
    (m) =>
      Array.from({ length: 25 }, (_, i) => i + 1).every(
        (score) => m.bands.filter((b) => score >= b.min && score <= b.max).length === 1,
      ),
    'Risk bands must cover scores 1–25 exactly once',
  );
const riskSchema = z.object({
  id: z.string().min(1),
  hazard: z.string().max(2000),
  people: z.string().max(2000),
  controls: z.string().max(5000),
  initialLikelihood: z.number().int().min(1).max(5),
  initialSeverity: z.number().int().min(1).max(5),
  residualLikelihood: z.number().int().min(1).max(5),
  residualSeverity: z.number().int().min(1).max(5),
  actions: z.string().max(5000),
  ownerId: z.string(),
  dueDate: date,
});
export const contentSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(50),
  type: z.enum(documentTypes),
  summary: z.string().max(1200),
  ownerId: z.string().min(1),
  facilityIds: ids,
  teamIds: ids,
  reviewDate: date,
  body: z.custom<JSONContent>(),
  riskRows: z.array(riskSchema).max(100),
  riskMatrix: z.custom<RiskMatrix>().nullable(),
  relatedIds: ids,
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(255),
        mime: z.string().max(150),
        size: z.number().int().positive().max(10485760),
      }),
    )
    .max(30),
});
const allowedNodes = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'horizontalRule',
  'hardBreak',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
  'image',
  'callout',
  'codeBlock',
  'taskList',
  'taskItem',
]);
const allowedMarks = new Set(['bold', 'italic', 'underline', 'strike', 'link', 'code', 'subscript', 'superscript', 'highlight', 'textStyle']);
export const safeUrl = (url: string) =>
  /^(https?:\/\/|mailto:|\/api\/docs\/files\/)/i.test(url) && !/[\u0000-\u001f]/.test(url);
export function validateBody(body: JSONContent): void {
  let count = 0;
  const walk = (node: JSONContent, depth: number) => {
    if (!node || !allowedNodes.has(node.type || '') || depth > 20 || ++count > 20000)
      throw new Error('This document contains unsupported or overly complex content.');
    if (node.text != null && typeof node.text !== 'string')
      throw new Error('Invalid document text.');
    for (const mark of node.marks || []) {
      if (
        !allowedMarks.has(mark.type) ||
        (mark.type === 'link' && !safeUrl(String(mark.attrs?.href || '')))
      )
        throw new Error('Use a valid http, https, or email link.');
      if ((mark.type === 'textStyle' || mark.type === 'highlight') && mark.attrs?.color != null && !safeColour(mark.attrs.color))
        throw new Error('Use a valid text or highlight colour.');
      if (mark.type === 'textStyle' && mark.attrs?.fontSize != null && !safeFontSize(mark.attrs.fontSize))
        throw new Error('Use a font size between 8 and 96 pixels.');
    }
    if (node.attrs?.textAlign != null && !safeAlignment(node.attrs.textAlign))
      throw new Error('Use left, centre, right or justified alignment.');
    if (node.type === 'taskItem' && typeof node.attrs?.checked !== 'boolean')
      throw new Error('Checklist items need a checked or unchecked state.');
    if (
      node.type === 'image' &&
      (!/^\/api\/docs\/files\/[a-zA-Z0-9-]+$/.test(node.attrs?.src || '') ||
        !String(node.attrs?.alt || '').trim())
    )
      throw new Error('Images need an uploaded file and alternative text.');
    if (node.type === 'heading' && !headingLevels.includes(node.attrs?.level))
      throw new Error('Use a heading from H1 to H6.');
    (node.content || []).forEach((child) => walk(child, depth + 1));
  };
  if (body?.type !== 'doc') throw new Error('Invalid document body.');
  walk(body, 0);
  if (JSON.stringify(body).length > 800000)
    throw new Error('Document exceeds the 800 KB content limit.');
}
export function plainText(node: JSONContent): string {
  return [node.text || '', ...(node.content || []).map(plainText)].filter(Boolean).join(' ');
}
export function contentSearch(content: DocumentContent): string {
  return [
    content.title,
    content.reference,
    content.summary,
    plainText(content.body),
    ...content.riskRows.map((r) => `${r.hazard} ${r.people} ${r.controls} ${r.actions}`),
  ].join(' ');
}
export function imageIds(node: JSONContent): string[] {
  return [
    ...(node.type === 'image'
      ? [
          String(node.attrs?.src || '')
            .split('/')
            .pop() || '',
        ]
      : []),
    ...(node.content || []).flatMap(imageIds),
  ];
}
export function riskBand(matrix: RiskMatrix | null, score: number) {
  return matrix?.bands.find((b) => score >= b.min && score <= b.max);
}
export const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
});
export const heading = (text: string): JSONContent => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});
