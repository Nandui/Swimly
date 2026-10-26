import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageIds, plainText, riskBand, safeUrl } from '@/modules/docs/shared/body';
import { safeAlignment, safeColour, safeFontSize } from '@/modules/docs/shared/formatting';
import { demoMatrix } from '@/test/docs-database';
import {
  canApprove, canManage, canRead, canWrite, docEventLabel, documentTypeLabels, documentTypes, toWorkspaceMember, type Member,
} from '@/modules/docs/shared/types';

/** Docs' small rules: who may do what, which links and styles a document may carry, and the
 *  words staff see. The workflow end to end is in __tests__/workflow.test.ts. Invented people. */
const member = (permissions: string[], more: Partial<Member> = {}): Member => ({
  id: 'riley', name: 'Riley Example', email: 'riley@example.invalid', role: 'member' as Member['role'], permissions, active: true, facilityIds: [], teamIds: [], ...more,
});

test('reading comes first: writing, approving and managing each need Docs read too, and nothing works once someone has left', () => {
  assert.deepEqual([canRead, canWrite, canApprove, canManage].map((can) => can(member(['docs.read']))), [true, false, false, false]);
  assert.equal(canWrite(member(['docs.read', 'docs.write'])), true);
  assert.equal(canRead(member(['docs.write'])), true, 'a level includes the ones before it');
  assert.equal(canApprove(member(['docs.read', 'docs.manage'])), false, 'approving is its own extra, not part of Manage');
  assert.equal(canApprove(member(['docs.read', 'docs.approve'])), true);
  assert.equal(canManage(member(['docs.read', 'docs.manage'])), true);
  const left = member(['docs.read', 'docs.write', 'docs.approve', 'docs.manage'], { active: false });
  assert.deepEqual([canRead, canWrite, canApprove, canManage].map((can) => can(left)), [false, false, false, false]);
});

test("a colleague reaches the browser with their name and access, and their contact details only for someone who manages Docs", () => {
  const colleague = member(['docs.read', 'docs.write'], { id: 'jamie', email: 'jamie@example.invalid' });
  const shown = toWorkspaceMember(colleague, member(['docs.read']));
  assert.equal('email' in shown, false);
  assert.equal('role' in shown, false);
  assert.deepEqual(shown.access, { read: true, write: true, approve: false });
  assert.equal(toWorkspaceMember(colleague, member(['docs.read', 'docs.manage'])).email, 'jamie@example.invalid');
  assert.equal('permissions' in shown, false, 'never the raw permissions');
});

test('a link may go to a web page, an email address or a Docs file, and nowhere else', () => {
  for (const url of ['https://example.invalid/policy', 'HTTP://example.invalid', 'mailto:duty@example.invalid', '/api/docs/files/abc']) assert.equal(safeUrl(url), true, url);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '/admin', '//example.invalid', 'https://example.invalid/\nx', 'ftp://example.invalid'])
    assert.equal(safeUrl(url), false, url);
});

test("a document's words and pictures are read out of its body in order", () => {
  const body = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Check the' }, { type: 'text', text: 'handover notes.' }] },
    { type: 'image', attrs: { src: '/api/docs/files/photo-1' } },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sign the log.' }] }] }] },
    { type: 'image', attrs: {} },
  ] };
  assert.equal(plainText(body), 'Check the handover notes. Sign the log.');
  assert.deepEqual(imageIds(body), ['photo-1', '']);
  assert.equal(plainText({ type: 'doc' }), '');
});

test("a risk's score falls in one of the matrix's bands, ends included, or none", () => {
  assert.equal(riskBand(demoMatrix, 4)?.label, 'Low');
  assert.equal(riskBand(demoMatrix, 5)?.label, 'Moderate');
  assert.equal(riskBand(demoMatrix, 25)?.label, 'Very high');
  assert.equal(riskBand(demoMatrix, 26), undefined);
  assert.equal(riskBand(null, 10), undefined, 'no matrix yet');
});

test('text styles stay within what the editor draws: plain colours, readable sizes, the four alignments', () => {
  for (const colour of ['#2563eb', '#abc', 'rgb(0, 0, 255)']) assert.equal(safeColour(colour), true, colour);
  for (const colour of ['#abcd', 'rgb(0,0,256)', 'blue', 42]) assert.equal(safeColour(colour), false, String(colour));
  for (const size of ['8px', '96px', '72pt', '12.5px']) assert.equal(safeFontSize(size), true, size);
  for (const size of ['7px', '97px', '73pt', '16em', 16]) assert.equal(safeFontSize(size), false, String(size));
  for (const align of ['left', 'center', 'right', 'justify']) assert.equal(safeAlignment(align), true);
  assert.equal(safeAlignment('start'), false);
});

test('every document type and history entry has words staff read', () => {
  for (const type of documentTypes) {
    const words = documentTypeLabels[type];
    assert.ok(words.one && words.many && words.long, type);
  }
  assert.equal(documentTypeLabels.SOP.one, 'Procedure');
  assert.equal(docEventLabel('submitted'), 'Sent for review');
  assert.equal(docEventLabel('reading_assigned'), 'Required reading updated');
  assert.equal(docEventLabel('some-new_code'), 'Some new code', 'an unknown code is sentence-cased, never shown raw');
});
