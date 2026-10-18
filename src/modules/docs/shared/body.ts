import type { JSONContent } from '@tiptap/react';
import type { RiskMatrix } from '@/modules/docs/shared/types';

/** Reading a document body, without the save checks in content.ts, so pages
 *  that only show a document don't download the validation library. */
export const safeUrl = (url: string) =>
  /^(https?:\/\/|mailto:|\/api\/docs\/files\/)/i.test(url) && !/[\u0000-\u001f]/.test(url);
export function plainText(node: JSONContent): string {
  return [node.text || '', ...(node.content || []).map(plainText)].filter(Boolean).join(' ');
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
