import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { documentExtensions } from './editor-extensions';
import { validateBody } from './content';
import { richDocumentExample } from '@/test/docs-rich-content';
import { documentWordCount, readableColour } from './formatting';

test('all editor formats validate and survive the actual editor schema', () => {
  validateBody(richDocumentExample);
  const schema = getSchema(documentExtensions());
  const document = schema.nodeFromJSON(richDocumentExample);
  document.check();
  const saved = document.toJSON();
  validateBody(saved);
  assert.deepEqual(schema.nodeFromJSON(JSON.parse(JSON.stringify(saved))).toJSON(), saved);
  assert.deepEqual(saved.content.slice(0, 6).map((node: JSONContent) => node.attrs?.level), [1, 2, 3, 4, 5, 6]);
  assert.equal(saved.content[6].attrs.textAlign, 'right');
  assert.equal(saved.content[6].content[0].marks.find((mark: JSONContent) => mark.type === 'textStyle').attrs.fontSize, '20px');
  assert.equal(saved.content[7].content[0].attrs.checked, true);
  assert.equal(saved.content[7].content[1].attrs.checked, false);
});

test('formatting does not allow unsafe colours, extreme sizes or invalid attributes', () => {
  const marked = (type: string, attrs: Record<string, unknown>): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Example', marks: [{ type, attrs }] }] }] });
  for (const color of ['url(https://example.com/track)', 'red;position:fixed', 'rgb(300,0,0)', 'var(--unsafe)']) {
    assert.throws(() => validateBody(marked('textStyle', { color })), /colour/);
    assert.throws(() => validateBody(marked('highlight', { color })), /colour/);
  }
  for (const fontSize of ['1000px', '0px', 'calc(100vh)', '16px;color:red'])
    assert.throws(() => validateBody(marked('textStyle', { fontSize })), /font size/);
  validateBody(marked('textStyle', { color: 'rgb(37, 99, 235)', fontSize: '12pt' }));
  for (const level of [0, 7, '1'])
    assert.throws(() => validateBody({ type: 'doc', content: [{ type: 'heading', attrs: { level } }] }), /H1 to H6/);
  assert.throws(() => validateBody({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'fixed' } }] }), /alignment/);
  assert.throws(() => validateBody({ type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: 'yes' } }] }] }), /checked/);
});

test('word count ignores mark boundaries and palette ink adapts to either theme', () => {
  assert.equal(documentWordCount({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hand', marks: [{ type: 'bold' }] }, { type: 'text', text: 'over' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'example' }] },
  ] }), 2);
  assert.equal(documentWordCount({ type: 'doc' }), 0);
  assert.equal(readableColour('rgb(37, 99, 235)'), 'light-dark(#2563eb, #93c5fd)');
});
