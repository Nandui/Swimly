import type { JSONContent } from '@tiptap/react';

/** Markdown to a Docs body (the editor's JSON), for bringing documents in from
 *  elsewhere: Notion's Markdown export, or the page text Notion's connector
 *  returns (the same Markdown plus a few tags: <columns>, <callout>, <table>).
 *  Only the nodes and marks Docs allows are produced (content.ts validates
 *  them again). Pure, so the rules are tested on their own. */

type Node = JSONContent;
type Mark = { type: string; attrs?: Record<string, unknown> };

const UNESCAPE = /\\([\\`*_{}[\]()#+\-.!|>~<])/g;

/** Inline Markdown: **bold**, *italic*, _italic_, `code`, ~~strike~~ and [links](url). */
export function inline(source: string, marks: Mark[] = []): Node[] {
  const out: Node[] = [];
  const text = (value: string, extra: Mark[] = []) => {
    const clean = value.replace(UNESCAPE, '$1');
    if (!clean) return;
    const all = [...marks, ...extra];
    out.push(all.length ? { type: 'text', text: clean, marks: all } : { type: 'text', text: clean });
  };
  const pattern = /(\\.)|(\*\*|__)(.+?)\2|(\*|_)(?!\s)(.+?)(?<!\s)\4(?![\w*])|`([^`]+)`|~~(.+?)~~|\[([^\]]+)\]\(([^)\s]+)\)|<br\s*\/?>/g;
  let last = 0;
  for (const m of source.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (m[1]) continue; // an escaped character stays in the running text
    text(source.slice(last, at));
    if (m[3] !== undefined) out.push(...inline(m[3], [...marks, { type: 'bold' }]));
    else if (m[5] !== undefined) out.push(...inline(m[5], [...marks, { type: 'italic' }]));
    else if (m[6] !== undefined) text(m[6], [{ type: 'code' }]);
    else if (m[7] !== undefined) out.push(...inline(m[7], [...marks, { type: 'strike' }]));
    else if (m[8] !== undefined) {
      const href = m[9];
      if (/^(https?:|mailto:)/i.test(href)) out.push(...inline(m[8], [...marks, { type: 'link', attrs: { href } }]));
      else out.push(...inline(m[8], marks)); // relative Notion links: keep the words
    } else out.push({ type: 'hardBreak' });
    last = at + m[0].length;
  }
  text(source.slice(last));
  return merge(out);
}

/** Neighbouring text with the same marks becomes one text node. */
function merge(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (prev && prev.type === 'text' && n.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(n.marks ?? [])) prev.text += n.text ?? '';
    else out.push(n);
  }
  return out;
}

const paragraph = (value: string): Node => {
  const content = inline(value.trim());
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

type Line = { indent: number; text: string };
const indentOf = (raw: string) => {
  const lead = /^[\t ]*/.exec(raw)![0];
  return lead.replace(/\t/g, '    ').length;
};

const BULLET = /^([-*+])\s+(.*)$/;
const ORDERED = /^(\d+)[.)]\s+(.*)$/;
const TASK = /^[-*+]\s+\[( |x|X)\]\s+(.*)$/;

/** A run of list lines, nested by indentation. */
function list(lines: Line[], start: number): { node: Node; next: number } {
  const base = lines[start].indent;
  const first = lines[start].text;
  const kind = TASK.test(first) ? 'taskList' : ORDERED.test(first) ? 'orderedList' : 'bulletList';
  const items: Node[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < base) break;
    if (line.indent === base) {
      const task = TASK.exec(line.text), ordered = ORDERED.exec(line.text), bullet = BULLET.exec(line.text);
      const sameKind = kind === 'taskList' ? !!task : kind === 'orderedList' ? !!ordered : !!bullet && !task;
      if (!sameKind) break;
      const body = task ? task[2] : ordered ? ordered[2] : bullet![2];
      const item: Node = kind === 'taskList'
        ? { type: 'taskItem', attrs: { checked: task![1].toLowerCase() === 'x' }, content: [paragraph(body)] }
        : { type: 'listItem', content: [paragraph(body)] };
      items.push(item);
      i++;
      continue;
    }
    // Deeper: a nested list, or a continuation paragraph, under the last item.
    const owner = items[items.length - 1];
    if (!owner) break;
    if (BULLET.test(line.text) || ORDERED.test(line.text)) {
      const nested = list(lines, i);
      owner.content!.push(nested.node);
      i = nested.next;
    } else {
      owner.content!.push(paragraph(line.text));
      i++;
    }
  }
  const node: Node = { type: kind, content: items };
  if (kind === 'orderedList') {
    const n = Number(ORDERED.exec(first)![1]);
    if (n !== 1) node.attrs = { start: n };
  }
  return { node, next: i };
}

function cells(row: string) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
}

function table(rows: string[][], header: boolean): Node {
  const width = Math.max(...rows.map((r) => r.length));
  return {
    type: 'table',
    content: rows.map((r, i) => ({
      type: 'tableRow',
      content: Array.from({ length: width }, (_, j) => ({
        type: header && i === 0 ? 'tableHeader' : 'tableCell',
        content: [paragraph(r[j] ?? '')],
      })),
    })),
  };
}

/** Notion's <table> tag: rows of <td> cells, the first row a header when marked. */
function htmlTable(source: string): Node | null {
  const rows = [...source.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
  if (!rows.length) return null;
  return table(rows, /header-row="true"/.test(source) || /<th/.test(source));
}

export function markdownToDoc(markdown: string): Node {
  const source = markdown.replace(/\r\n?/g, '\n')
    // Notion's layout and page furniture carry no words of their own.
    .replace(/<\/?(columns|column|page|empty-block)[^>]*>/g, '\n')
    .replace(/<mention-[^>]*>([^<]*)<\/mention-[^>]*>/g, '$1')
    .replace(/<(image|file|video|pdf|embed|bookmark)[^>]*\/?>(<\/\1>)?/g, '\n');
  const lines: Line[] = source.split('\n').map((raw) => ({ indent: indentOf(raw), text: raw.trim() }));
  const content: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const { text } = lines[i];
    if (!text) { i++; continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(text);
    if (heading) { content.push({ type: 'heading', attrs: { level: heading[1].length }, content: inline(heading[2].replace(/\s+#+\s*$/, '')) }); i++; continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) { content.push({ type: 'horizontalRule' }); i++; continue; }

    if (BULLET.test(text) || ORDERED.test(text)) {
      const sub = lines.slice(i);
      const base = sub[0].indent;
      const block: Line[] = [];
      for (const l of sub) { if (!l.text) break; block.push({ indent: Math.max(0, l.indent - base), text: l.text }); }
      const done = list(block, 0);
      content.push(done.node);
      i += done.next || 1;
      continue;
    }

    if (text.startsWith('|') && lines[i + 1]?.text.match(/^\|?\s*:?-{2,}/)) {
      const rows = [cells(text)];
      i += 2;
      while (i < lines.length && lines[i].text.startsWith('|')) rows.push(cells(lines[i++].text));
      content.push(table(rows, true));
      continue;
    }

    if (/^<table/.test(text)) {
      const start = i;
      while (i < lines.length && !/<\/table>/.test(lines[i].text)) i++;
      const node = htmlTable(lines.slice(start, i + 1).map((l) => l.text).join('\n'));
      if (node) content.push(node);
      i++;
      continue;
    }

    const callout = /^<callout([^>]*)>(.*?)(<\/callout>)?$/.exec(text);
    if (callout) {
      const inner: string[] = [callout[2]];
      i++;
      if (!callout[3]) {
        while (i < lines.length && !/<\/callout>/.test(lines[i].text)) inner.push(lines[i++].text);
        if (i < lines.length) inner.push(lines[i++].text.replace(/<\/callout>/, ''));
      }
      const body = markdownToDoc(inner.join('\n')).content ?? [];
      const warning = /red|orange|yellow|⚠|❗|🚨/.test(callout[1] + inner.join(' '));
      content.push({ type: 'callout', attrs: { kind: warning ? 'warning' : 'info' }, content: body.length ? body : [{ type: 'paragraph' }] });
      continue;
    }

    if (/^<\/?(details|summary)/.test(text)) {
      const summary = /<summary>(.*?)<\/summary>/.exec(text);
      if (summary) content.push({ type: 'heading', attrs: { level: 4 }, content: inline(summary[1]) });
      i++;
      continue;
    }

    if (text.startsWith('>')) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].text.startsWith('>')) quoted.push(lines[i++].text.replace(/^>\s?/, ''));
      const body = markdownToDoc(quoted.join('\n')).content ?? [];
      content.push({ type: 'blockquote', content: body.length ? body : [{ type: 'paragraph' }] });
      continue;
    }

    if (/^<[a-z-]+[^>]*>$/.test(text) || /^<\/[a-z-]+>$/.test(text)) { i++; continue; } // other layout tags

    // Notion puts each line of a column or a property block on its own line: keep them apart.
    content.push(paragraph(text));
    i++;
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/** The words of a body, for a summary or a search. */
export function firstParagraphAfter(doc: Node, headingPattern: RegExp): string {
  const blocks = doc.content ?? [];
  const at = blocks.findIndex((b) => b.type === 'heading' && headingPattern.test(textOf(b)));
  const next = at >= 0 ? blocks.slice(at + 1).find((b) => b.type === 'paragraph' && textOf(b).trim()) : undefined;
  return next ? textOf(next).trim() : '';
}

export function textOf(node: Node): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(textOf).join(node.type === 'doc' ? '\n' : '');
}
