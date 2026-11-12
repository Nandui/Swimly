import type { JSONContent } from '@tiptap/react';
import type { DocumentType } from '@/modules/docs/shared/types';
import { firstParagraphAfter, markdownToDoc, textOf } from '@/modules/docs/features/import/server/markdown';

/** One page of a Notion document register, read into what a Docs document
 *  needs: reference, title, type, whether it is still a draft, the review
 *  date, a summary and the body. Accepts Notion's Markdown export (a "# Title"
 *  line, then "Property: value" lines) and the page text Notion's connector
 *  returns (<page> with <properties> and <content>). Pure and tested. */

export type NotionPage = {
  reference: string;
  title: string;
  type: DocumentType;
  draft: boolean;
  reviewDate: string;
  summary: string;
  tags: string[];
  body: JSONContent;
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const unescape = (value: string) => value.replace(/\\([\\[\]|*_])/g, '$1').trim();

/** "June 2027" or "2027-06-30" as an ISO date; the first of the month when only a month is given. */
export function reviewDateFrom(value: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return iso[0];
  const month = new RegExp(`(${MONTHS.join('|')})\\s+(\\d{4})`, 'i').exec(value);
  if (month) return `${month[2]}-${String(MONTHS.indexOf(month[1].toLowerCase()) + 1).padStart(2, '0')}-01`;
  return null;
}

export function parseNotionPage(text: string, fileName = '', today = new Date().toISOString().slice(0, 10)): NotionPage {
  let heading = '';
  let tags: string[] = [];
  let content = text.replace(/\r\n?/g, '\n');

  const connector = /<content>([\s\S]*?)<\/content>/.exec(content);
  if (connector) {
    const title = /"title":"((?:[^"\\]|\\.)*)"/.exec(content);
    heading = title ? JSON.parse(`"${title[1]}"`) : '';
    const tagList = /"Tags":"(\[[^\]]*\])"/.exec(content) ?? /"Tags":(\[[^\]]*\])/.exec(content);
    if (tagList) { try { tags = JSON.parse(tagList[1].replace(/\\"/g, '"')); } catch { tags = []; } }
    content = connector[1];
  } else {
    const lines = content.split('\n');
    const at = lines.findIndex((l) => /^#\s+/.test(l));
    if (at >= 0) {
      heading = lines[at].replace(/^#\s+/, '');
      // Notion's export lists the page's properties under its title, then a blank line.
      let i = at + 1;
      while (i < lines.length && !lines[i].trim()) i++;
      while (i < lines.length && /^[A-Z][\w ]{1,30}:\s/.test(lines[i])) {
        const [, key, value] = /^([A-Z][\w ]{1,30}):\s*(.*)$/.exec(lines[i])!;
        if (key.toLowerCase() === 'tags') tags = value.split(',').map((t) => t.trim()).filter(Boolean);
        i++;
      }
      content = lines.slice(i).join('\n');
    }
  }
  if (!heading) heading = fileName.replace(/\.md$/i, '').replace(/\s+[0-9a-f]{32}$/i, '');
  heading = unescape(heading);

  const ref = /^\[([^\]]+)\]\s*(.*)$/.exec(heading);
  const reference = ref ? ref[1].trim() : heading.slice(0, 50);
  const title = (ref ? ref[2] : heading).replace(/^\[SOP\]\s*/i, '').trim() || reference;

  const status = /\*\*Status:\*\*\s*([A-Za-z ]+?)\s*(\\?\||$)/m.exec(content)?.[1]?.trim().toLowerCase() ?? '';
  const draft = tags.includes('Draft') || status === 'draft';
  const type: DocumentType = tags.includes('NOP') || /(^|-)NOP$/.test(reference) ? 'NOP'
    : tags.includes('EAP') || /\bEAP\b/.test(title) ? 'EAP'
    : tags.includes('Register') ? 'Custom' : 'SOP';

  const review = /\*\*Next review:\*\*\s*([^|\\\n]+)/.exec(content)?.[1] ?? '';
  const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  const reviewDate = reviewDateFrom(review) ?? nextYear;

  const body = markdownToDoc(content);
  const purpose = firstParagraphAfter(body, /purpose/i);
  const appliesTo = /Applies to:\s*(.+)/.exec(content)?.[1];
  const words = textOf(body).replace(/\s+/g, ' ').trim();
  const summary = (purpose || (appliesTo ? `Applies to ${unescape(appliesTo)}` : '') || words).slice(0, 600);

  return { reference: reference.slice(0, 50), title: title.slice(0, 200), type, draft, reviewDate, summary: summary || title, tags, body };
}
