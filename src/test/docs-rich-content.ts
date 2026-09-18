import type { JSONContent } from '@tiptap/react';

/** Fictional document content for editor and save/reopen verification. */
export const richDocumentExample: JSONContent = {
  type: 'doc', content: [
    ...[1, 2, 3, 4, 5, 6].map(level => ({
      type: 'heading', attrs: { level, textAlign: level === 1 ? 'center' : 'left' },
      content: [{ type: 'text', text: `Heading ${level} example` }],
    })),
    { type: 'paragraph', attrs: { textAlign: 'right' }, content: [
      { type: 'text', text: 'Formatted example', marks: [
        { type: 'bold' }, { type: 'italic' }, { type: 'underline' }, { type: 'strike' },
        { type: 'textStyle', attrs: { color: '#2563eb', fontSize: '20px' } },
        { type: 'highlight', attrs: { color: '#fef08a' } },
      ] },
      { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
      { type: 'text', text: '3', marks: [{ type: 'superscript' }] },
      { type: 'text', text: ' example_code ', marks: [{ type: 'code' }] },
      { type: 'text', text: 'Example link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    ] },
    { type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Read the example handover' }] }] },
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Check the example notes' }] }] },
    ] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Example handover reminder' }] }] },
    { type: 'codeBlock', content: [{ type: 'text', text: 'example = true\n// Keep the line breaks' }] },
    { type: 'horizontalRule' },
    { type: 'table', content: [{ type: 'tableRow', content: [
      { type: 'tableHeader', attrs: { colspan: 2, rowspan: 1 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Example merged header' }] }] },
    ] }] },
  ],
};
