import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "../../test/pglite-prisma";
import { serverModule } from "../../test/server-module";
import { money, parseFields, type RefundCommand } from "./rules";
import { canReadRefund, type RefundActor, type RefundFields } from "./types";
import { cleanScreens, homePathFor, isAquaticsScreen, visibleScreens } from "../staff/screens";
import { expandPermissions } from "../staff/permissions";

let db: Awaited<ReturnType<typeof isolatedPrisma>>;
let service: typeof import('./service'), files: typeof import('./files'), notifications: typeof import('./notifications'), data: typeof import('./data'), actions: typeof import('./actions');
let uploadRoute: typeof import('../../app/api/refunds/files/route'), downloadRoute: typeof import('../../app/api/refunds/files/[id]/route');
const reception: RefundActor = { id: 'refund-reception', name: 'Alex Example', request: true, review: false, process: false };
const finance: RefundActor = { id: 'refund-finance', name: 'Riley Example', request: false, review: true, process: true };
const colleague: RefundActor = { ...reception, id: 'refund-colleague', name: 'Jamie Example' };
const fields: RefundFields = { clubId: 'refund-site-a', customerName: 'Casey Example', contactEmail: 'customer@example.test', contactPhone: '', memberNumber: 'EXAMPLE-1', service: 'MEMBERSHIP', description: 'Unused membership month', amount: '80.00', paymentDate: '2026-01-01', paymentReference: 'EXAMPLE-PAYMENT', reason: 'Duplicate purchase' };
let mailFails = false, auditFails = false;
let current = reception, currentGrants = ['refunds.request'];
const sent: { email: string; subject: string; text: string }[] = [];
const priorEnv = process.env.REFUNDS_APP_URL;

before(async () => {
  db = await isolatedPrisma();
  await db.prisma.club.createMany({ data: [{ id: 'refund-site-a', name: 'Example site A' }, { id: 'refund-site-b', name: 'Example site B' }] });
  for (const [id, permissions] of [['refund-reception-role', ['refunds.request']], ['refund-finance-role', ['refunds.review','refunds.process']]] as const) await db.prisma.staffRole.create({ data: { id, name: id, permissions: [...permissions], screens: ['refunds'] } });
  for (const who of [reception, finance, colleague]) await db.prisma.user.create({ data: { id: who.id, name: who.name, email: `${who.id}@example.test`, staffRoleId: who.review ? 'refund-finance-role' : 'refund-reception-role' } });
  const doubles = {
    '@/lib/prisma': { prisma: db.prisma },
    '@/auth': { auth: async () => ({ user: { ...current, permissions: currentGrants, screens: ['refunds'] } }) },
    '@/lib/audit': { logAudit: async (input: Parameters<typeof import('../audit').logAudit>[0], tx: typeof db.prisma) => { if (auditFails) throw new Error('Audit failed'); await tx.auditLog.create({ data: input }); } },
    '@/lib/parent/email': { parentEmailConfig: () => ({ sender: 'sender@example.test', fromHeader: 'Example <sender@example.test>' }) },
    '@/lib/email/google': { sendGoogleTextEmail: async (email: string, subject: string, text: string) => { if (mailFails) throw new Error('Synthetic rejection'); sent.push({ email, subject, text }); } },
    'next/cache': { revalidatePath() {} },
  };
  service = serverModule('src/lib/refunds/service.ts', doubles);
  files = serverModule('src/lib/refunds/files.ts', doubles);
  notifications = serverModule('src/lib/refunds/notifications.ts', doubles);
  data = serverModule('src/lib/refunds/data.ts', doubles);
  actions = serverModule('src/lib/refunds/actions.ts', doubles);
  uploadRoute = serverModule('src/app/api/refunds/files/route.ts', doubles);
  downloadRoute = serverModule('src/app/api/refunds/files/[id]/route.ts', doubles);
  process.env.REFUNDS_APP_URL = 'https://staff.example.test';
});
after(async () => { if (priorEnv === undefined) delete process.env.REFUNDS_APP_URL; else process.env.REFUNDS_APP_URL = priorEnv; await db?.close(); });
const create = (overrides: Partial<RefundFields> = {}, action: 'save' | 'submit' = 'submit') => service.mutateRefund(reception, { id: randomUUID(), operationId: randomUUID(), version: 0, action, fields: { ...fields, ...overrides } });
const command = (row: { id: string; version: number }, action: RefundCommand['action'], more: Partial<RefundCommand> = {}): RefundCommand => ({ id: row.id, version: row.version, operationId: randomUUID(), action, ...more });

test('money, date and submission validation avoid floating point and incomplete submissions', () => {
  assert.equal(money('0.29'), 29); assert.equal(money('9999999.99'), 999999999);
  for (const value of ['0','-1','1e3','12.345','NaN']) assert.throws(() => money(value));
  assert.throws(() => parseFields({ ...fields, customerName: '' }, true), /Complete/);
  assert.throws(() => parseFields({ ...fields, paymentDate: '2026-02-30' }, true), /valid payment date/);
  assert.equal(parseFields({ ...fields, amount: '', customerName: '' }, false).requestedCents, null);
});
test('refund permissions preserve module boundaries and administrator inheritance', () => {
  assert.deepEqual([...visibleScreens(['refunds'], expandPermissions(['refunds.request']))], ['refunds']);
  assert.equal(visibleScreens(['refunds'], expandPermissions([])).size, 0);
  assert.equal(expandPermissions(['refunds.review']).has('refunds.process'), false);
  assert.equal(expandPermissions(['staff.manage','roles.manage']).has('refunds.process'), true);
  assert.equal(homePathFor('calendar', ['refunds.read'], ['refunds'], 'desk'), '/account');
  assert.equal(isAquaticsScreen('refunds'), false);
  assert.deepEqual(cleanScreens(['today','refunds']), ['refunds','instructor']);
});
test('real additive migration supports private drafts, including withdrawn drafts, and cross-site reads', async () => {
  const draft = await create({}, 'save');
  assert.equal(canReadRefund(draft, colleague), false);
  await assert.rejects(service.mutateRefund(colleague, command(draft, 'submit', { fields })), /not available/);
  const withdrawn = await service.mutateRefund(reception, command(draft, 'withdraw', { note: 'Draft no longer needed' }));
  assert.equal(canReadRefund(withdrawn, finance), false);
  const submitted = await create({ clubId: 'refund-site-b' });
  assert.equal(canReadRefund(submitted, colleague), true);
  current = colleague;
  const queue = await data.listRefunds({ status: 'all' });
  assert.ok(queue.rows.some(row => row.id === submitted.id));
  assert.ok(!queue.rows.some(row => row.id === withdrawn.id));
  await assert.rejects(data.getRefund(withdrawn.id), /not available/);
  current = reception;
});
test('request retries are idempotent, conflicting decisions are rejected and audit failure rolls back', async () => {
  const input = { id: randomUUID(), operationId: randomUUID(), version: 0, action: 'submit' as const, fields };
  const [first, retried] = await Promise.all([service.mutateRefund(reception, input), service.mutateRefund(reception, input)]);
  assert.equal(first.id, retried.id); assert.equal(first.version, retried.version);
  assert.equal(await db.prisma.refundEvent.count({ where: { requestId: first.id } }), 1);
  const results = await Promise.allSettled([service.mutateRefund(finance, command(first, 'approve', { amount: '80' })), service.mutateRefund(finance, command(first, 'decline', { note: 'Not eligible' }))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(String((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason), /changed while/);
  const before = await db.prisma.refundRequest.count(); auditFails = true;
  await assert.rejects(create(), /Audit failed/); auditFails = false;
  assert.equal(await db.prisma.refundRequest.count(), before);
});
test('finance can take over, request information and review the preserved resubmission', async () => {
  const row = await create();
  const claimed = await service.mutateRefund(finance, command(row, 'claim'));
  assert.equal(claimed.handlerId, finance.id);
  const takenOver = await service.mutateRefund({ ...colleague, review: true }, command(claimed, 'claim'));
  assert.equal(takenOver.handlerId, colleague.id);
  assert.equal(await db.prisma.refundEvent.count({ where: { requestId: row.id, action: 'claim' } }), 2);
  const returned = await service.mutateRefund(finance, command(takenOver, 'information', { note: 'Confirm the period purchased.' }));
  const resubmitted = await service.mutateRefund(colleague, command(returned, 'submit', { fields: { ...fields, description: 'Corrected membership period' } }));
  const events = await db.prisma.refundEvent.findMany({ where: { requestId: row.id, action: 'submit' }, orderBy: { createdAt: 'asc' } });
  assert.equal(events.length, 2);
  assert.equal((events[0].snapshot as { description: string }).description, fields.description);
  assert.equal(resubmitted.creatorId, reception.id);
  await assert.rejects(service.mutateRefund({ ...reception, review: true }, command(resubmitted, 'approve', { amount: '80' })), /Another finance/);
});
test('reduced approval requires a reason; payment can be recorded once and the completed record cannot change', async () => {
  const row = await create();
  await assert.rejects(service.mutateRefund(finance, command(row, 'approve', { amount: '100' })), /no higher/);
  await assert.rejects(service.mutateRefund(finance, command(row, 'approve', { amount: '60' })), /Explain why/);
  const approved = await service.mutateRefund(finance, command(row, 'approve', { amount: '60', note: 'Used part of the service.' }));
  assert.equal(approved.requestedCents, 8000); assert.equal(approved.approvedCents, 6000);
  await assert.rejects(service.mutateRefund(reception, command(approved, 'pay')), /permission/);
  await assert.rejects(service.mutateRefund({ ...finance, process: false }, command(approved, 'pay')), /permission/);
  const payment = command(approved, 'pay', { paidOn: '2026-01-02', paidMethod: 'CARD', paidReference: 'EXAMPLE-REFUND' });
  const paid = await service.mutateRefund(finance, payment), retry = await service.mutateRefund(finance, payment);
  assert.equal(paid.status, 'REFUNDED'); assert.equal(retry.version, paid.version);
  assert.equal(await db.prisma.refundEvent.count({ where: { requestId: row.id, action: 'pay' } }), 1);
  for (const action of ['cancel','withdraw','approve','pay'] as const) await assert.rejects(service.mutateRefund({ ...finance, request: true }, command(paid, action, { note: 'Change', amount: '50' })));
});
test('receipt type, size, limit and private download guards are enforced with real stored bytes', async () => {
  let draft = await create({}, 'save');
  const file = new File(['%PDF-1.4 synthetic receipt'], 'receipt.pdf', { type: 'application/pdf' });
  const firstId = randomUUID();
  const input = { id: draft.id, version: draft.version, attachmentId: firstId, operationId: randomUUID() };
  draft = await files.changeReceipt(reception, input, file);
  assert.equal((await files.changeReceipt(reception, input, file)).version, draft.version);
  const receipt = await files.readReceipt(reception, firstId);
  assert.match(Buffer.from(receipt.bytes).toString(), /synthetic receipt/);
  await assert.rejects(files.readReceipt(finance, firstId), /not available/);
  await assert.rejects(files.changeReceipt(reception, { ...input, operationId: randomUUID(), version: draft.version }, new File(['<html>'], 'receipt.pdf', { type: 'application/pdf' })), /valid PDF/);
  assert.throws(() => files.validateReceipt({ name: 'a.pdf', type: 'application/pdf', size: 4 * 1024 * 1024 + 1 }, Buffer.alloc(4 * 1024 * 1024 + 1)), /valid PDF/);
  for (let i = 1; i < 5; i++) draft = await files.changeReceipt(reception, { id: draft.id, version: draft.version, attachmentId: randomUUID(), operationId: randomUUID() }, file);
  await assert.rejects(files.changeReceipt(reception, { id: draft.id, version: draft.version, attachmentId: randomUUID(), operationId: randomUUID() }, file), /five receipts/);
  draft = await files.changeReceipt(reception, { id: draft.id, version: draft.version, attachmentId: firstId, operationId: randomUUID() });
  const submitted = await service.mutateRefund(reception, command(draft, 'submit', { fields }));
  assert.ok(await files.readReceipt(finance, firstId));
  await assert.rejects(files.changeReceipt(reception, { id: draft.id, version: submitted.version, attachmentId: randomUUID(), operationId: randomUUID() }, file), /only change/);
});
test('saved requests survive failed email; retry sends staff-only minimal alerts and does not resend accepted jobs', async () => {
  current = reception; currentGrants = ['refunds.request']; mailFails = true;
  const result = await actions.saveRefund({ id: randomUUID(), operationId: randomUUID(), version: 0, action: 'submit', fields });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.match(result.warning || '', /Saved/);
  assert.equal((await db.prisma.refundRequest.findUniqueOrThrow({ where: { id: result.id } })).status, 'SUBMITTED');
  assert.equal(await db.prisma.refundNotification.count({ where: { requestId: result.id, status: 'FAILED' } }), 1);
  mailFails = false; const previous = sent.length;
  await notifications.deliverRefundNotifications(result.id, finance, true);
  assert.equal(sent.length, previous + 1); assert.equal(sent.at(-1)?.email, 'refund-finance@example.test');
  assert.ok(!sent.at(-1)?.text.includes(fields.customerName)); assert.ok(!sent.at(-1)?.text.includes(fields.contactEmail));
  await notifications.deliverRefundNotifications(result.id, finance, true); assert.equal(sent.length, previous + 1);
  const row = await db.prisma.refundRequest.findUniqueOrThrow({ where: { id: result.id } });
  await service.mutateRefund(finance, command(row, 'decline', { note: 'Outside the agreed terms.' }));
  await notifications.deliverRefundNotifications(result.id, finance); assert.equal(sent.at(-1)?.email, 'refund-reception@example.test');
});
test('revoked finance access suppresses queued emails and revoked requester permission blocks actions', async () => {
  const row = await create(), previous = sent.length;
  await db.prisma.staffRole.update({ where: { id: 'refund-finance-role' }, data: { permissions: [] } });
  await notifications.deliverRefundNotifications(row.id, finance); assert.equal(sent.length, previous);
  assert.equal(await db.prisma.refundNotification.count({ where: { requestId: row.id, status: 'SKIPPED' } }), 1);
  currentGrants = [];
  const attempt = await actions.saveRefund({ id: randomUUID(), operationId: randomUUID(), version: 0, action: 'submit', fields });
  assert.equal(attempt.ok, false);
  currentGrants = ['refunds.request'];
  await db.prisma.staffRole.update({ where: { id: 'refund-finance-role' }, data: { permissions: ['refunds.review','refunds.process'] } });
  const beforeDeactivation = await create();
  await db.prisma.user.update({ where: { id: finance.id }, data: { isActive: false } });
  await notifications.deliverRefundNotifications(beforeDeactivation.id, reception);
  assert.equal(sent.length, previous);
  assert.equal(await db.prisma.refundNotification.count({ where: { requestId: beforeDeactivation.id, status: 'SKIPPED' } }), 1);
  await db.prisma.user.update({ where: { id: finance.id }, data: { isActive: true } });
});

test('unpaid approvals can be cancelled with a reason, and site filters and totals agree', async () => {
  const row = await create({ clubId: 'refund-site-b', memberNumber: 'FILTER-CHECK' });
  const approved = await service.mutateRefund(finance, command(row, 'approve', { amount: '80' }));
  await assert.rejects(service.mutateRefund(finance, command(approved, 'cancel')), /reason/);
  const cancelled = await service.mutateRefund(finance, command(approved, 'cancel', { note: 'Customer chose to keep the booking; no payment was made.' }));
  assert.equal(cancelled.status, 'WITHDRAWN'); assert.equal(cancelled.approvedCents, 8000);
  await assert.rejects(service.mutateRefund(finance, command(cancelled, 'pay', { paidOn: '2026-01-02', paidMethod: 'CARD', paidReference: 'test' })), /approved, unpaid/);
  const matching = await data.listRefunds({ q: 'FILTER-CHECK', site: 'refund-site-b', status: 'all' });
  assert.equal(matching.total, 1); assert.equal(matching.counts.WITHDRAWN, 1);
  const otherSite = await data.listRefunds({ q: 'FILTER-CHECK', site: 'refund-site-a', status: 'all' });
  assert.equal(otherSite.total, 0);
});

test('missing finance recipients stay visible and can be resolved without recreating the request', async () => {
  await db.prisma.staffRole.update({ where: { id: 'refund-finance-role' }, data: { permissions: [] } });
  const row = await create();
  assert.equal(await db.prisma.refundNotification.count({ where: { requestId: row.id, recipientId: 'unassigned' } }), 1);
  await notifications.deliverRefundNotifications(row.id, reception);
  assert.equal(await db.prisma.refundNotification.count({ where: { requestId: row.id, status: 'FAILED' } }), 1);
  await db.prisma.staffRole.update({ where: { id: 'refund-finance-role' }, data: { permissions: ['refunds.review','refunds.process'] } });
  assert.equal(await notifications.deliverRefundNotifications(row.id, finance, true), 0);
  assert.equal(await db.prisma.refundNotification.count({ where: { requestId: row.id, status: 'SENT' } }), 1);
});

test('receipt HTTP routes require same-origin writes, preserve bytes and deny private downloads', async () => {
  current = reception; currentGrants = ['refunds.request'];
  const row = await create({}, 'save'), attachmentId = randomUUID(), operationId = randomUUID();
  function upload(origin: string, version = row.version, op = operationId) {
    const form = new FormData();
    form.set('id', row.id); form.set('version', String(version)); form.set('attachmentId', attachmentId); form.set('operationId', op);
    form.set('file', new File(['%PDF-1.4 example private receipt'], 'receipt.pdf', { type: 'application/pdf' }));
    return new Request('https://staff.example.test/api/refunds/files', { method: 'POST', body: form, headers: { Origin: origin, Host: 'staff.example.test' } });
  }
  assert.equal((await uploadRoute.POST(upload('https://other.example.test'))).status, 403);
  const saved = await uploadRoute.POST(upload('https://staff.example.test'));
  assert.equal(saved.status, 200); assert.equal((await saved.json()).ok, true);
  const params = { params: Promise.resolve({ id: attachmentId }) };
  const downloaded = await downloadRoute.GET(new Request('https://staff.example.test'), params);
  assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get('content-disposition') || '', /attachment/);
  assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
  assert.match(await downloaded.text(), /example private receipt/);
  assert.equal((await uploadRoute.POST(upload('https://staff.example.test', row.version, randomUUID()))).status, 400);
  current = finance; currentGrants = ['refunds.review','refunds.process'];
  assert.equal((await downloadRoute.GET(new Request('https://staff.example.test'), params)).status, 404);
  current = reception; currentGrants = ['refunds.request'];
});
