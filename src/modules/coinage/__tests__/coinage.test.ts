import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { money, parseFields, type CoinageCommand } from "../shared/rules";
import { canReadCoinage, coinageLines, coinageNextActions, type CoinageActor, type CoinageFields } from "../shared/types";
import { isActivitiesScreen, visibleScreens } from "@/lib/staff/screens";
import { expandPermissions } from "@/lib/staff/permissions";

let db: Awaited<ReturnType<typeof isolatedPrisma>>;
let service: typeof import('../shared/service'), notifications: typeof import('../features/request/server/notifications'), list: typeof import('../features/queue/server/list'), detail: typeof import('../features/request/server/data'), actions: typeof import('../features/request/server/actions'), home: typeof import('../features/queue/server/home');
const desk: CoinageActor = { id: 'coin-desk', name: 'Alex Example', request: true, review: false, process: false };
const accounts: CoinageActor = { id: 'coin-accounts', name: 'Riley Example', request: false, review: true, process: true };
const colleague: CoinageActor = { ...desk, id: 'coin-colleague', name: 'Jamie Example' };
const fields: CoinageFields = { clubId: 'coin-site-a', forWhom: 'Reception till 2', neededBy: '2099-01-01', notes: 'Busy weekend', line200: '50', line100: '20.00', line5: '2.50' };
let mailFails = false, auditFails = false;
let current = desk, currentGrants = ['coinage.request'];
const sent: { email: string; subject: string; text: string }[] = [];
const priorEnv = process.env.COINAGE_APP_URL;

before(async () => {
  db = await isolatedPrisma();
  await db.prisma.club.createMany({ data: [{ id: 'coin-site-a', name: 'Example site A' }, { id: 'coin-site-b', name: 'Example site B' }] });
  for (const [id, permissions] of [['coin-desk-role', ['coinage.request']], ['coin-accounts-role', ['coinage.review', 'coinage.process']]] as const) await db.prisma.staffRole.create({ data: { id, name: id, permissions: [...permissions], screens: ['coinage'] } });
  for (const who of [desk, accounts, colleague]) await db.prisma.user.create({ data: { id: who.id, name: who.name, email: `${who.id}@example.test`, staffRoleId: who.review ? 'coin-accounts-role' : 'coin-desk-role' } });
  const doubles = {
    '@/lib/prisma': { prisma: db.prisma },
    '@/auth': { auth: async () => ({ user: { ...current, permissions: currentGrants, screens: ['coinage'] } }) },
    '@/lib/audit': { logAudit: async (input: Parameters<typeof import('@/lib/audit').logAudit>[0], tx: typeof db.prisma) => { if (auditFails) throw new Error('Audit failed'); await tx.auditLog.create({ data: input }); } },
    '@/lib/email/sender': { emailSender: () => ({ sender: 'sender@example.test', fromHeader: 'Example <sender@example.test>' }) },
    '@/lib/email/google': { sendGoogleTextEmail: async (email: string, subject: string, text: string) => { if (mailFails) throw new Error('Synthetic rejection'); sent.push({ email, subject, text }); } },
    'next/cache': { revalidatePath() {} },
    'server-only': {},
  };
  service = serverModule('src/modules/coinage/shared/service.ts', doubles);
  notifications = serverModule('src/modules/coinage/features/request/server/notifications.ts', doubles);
  list = serverModule('src/modules/coinage/features/queue/server/list.ts', doubles);
  detail = serverModule('src/modules/coinage/features/request/server/data.ts', doubles);
  actions = serverModule('src/modules/coinage/features/request/server/actions.ts', doubles);
  home = serverModule('src/modules/coinage/features/queue/server/home.ts', doubles);
  process.env.COINAGE_APP_URL = 'https://staff.example.test';
});
after(async () => { if (priorEnv === undefined) delete process.env.COINAGE_APP_URL; else process.env.COINAGE_APP_URL = priorEnv; await db?.close(); });
const create = (overrides: Partial<CoinageFields> = {}, action: 'save' | 'submit' = 'submit') => service.mutateCoinage(desk, { id: randomUUID(), operationId: randomUUID(), version: 0, action, fields: { ...fields, ...overrides } });
const command = (row: { id: string; version: number }, action: CoinageCommand['action'], more: Partial<CoinageCommand> = {}): CoinageCommand => ({ id: row.id, version: row.version, operationId: randomUUID(), action, ...more });
const order = { orderedOn: '2026-01-02', deliveryOn: '2026-01-05', orderReference: 'EXAMPLE-ORDER' };

test('amounts are whole coins in cents, and sending needs who, when and something to send', () => {
  assert.equal(money('0.29'), 29); assert.equal(money(''), null);
  for (const value of ['-1', '1e3', '12.345', 'NaN']) assert.throws(() => money(value));
  const parsed = parseFields(fields, true, '2026-10-21');
  assert.deepEqual(parsed.lines, { 200: 5000, 100: 2000, 5: 250 }); assert.equal(parsed.totalCents, 7250);
  assert.deepEqual(coinageLines(parsed.lines).map(line => [line.label, line.pieces]), [['€2 coins', 25], ['€1 coins', 20], ['5c coins', 50]]);
  assert.throws(() => parseFields({ ...fields, line200: '51' }, true, '2026-10-21'), /whole number of them/);
  assert.throws(() => parseFields({ ...fields, line200: '', line100: '', line5: '' }, true, '2026-10-21'), /at least one coin/);
  assert.throws(() => parseFields({ ...fields, forWhom: '' }, true, '2026-10-21'), /who it is for/);
  assert.throws(() => parseFields({ ...fields, neededBy: '2026-10-20' }, true, '2026-10-21'), /today or a later day/);
  assert.equal(parseFields({ clubId: 'x', forWhom: '', neededBy: '', notes: '' }, false).totalCents, null);
});
test('coinage permissions give their own screen, never the swim school, and administrators inherit them', () => {
  assert.deepEqual([...visibleScreens(expandPermissions(['coinage.request']))], ['coinage']);
  assert.equal(expandPermissions(['coinage.review']).has('coinage.process'), false);
  assert.equal(expandPermissions(['staff.manage', 'roles.manage']).has('coinage.process'), true);
  assert.equal(isActivitiesScreen('coinage'), false);
});
test('drafts stay private, sent requests are shared across sites', async () => {
  const draft = await create({}, 'save');
  assert.equal(canReadCoinage(draft, colleague), false);
  await assert.rejects(service.mutateCoinage(colleague, command(draft, 'submit', { fields })), /not available/);
  const sentRow = await create({ clubId: 'coin-site-b' });
  current = colleague;
  const queue = await list.listCoinage({ status: 'all' });
  assert.ok(queue.rows.some(row => row.id === sentRow.id));
  assert.ok(!queue.rows.some(row => row.id === draft.id));
  await assert.rejects(detail.getCoinage(draft.id), /not available/);
  current = desk;
});
test('retries are idempotent, clashing decisions fail and an audit failure rolls back', async () => {
  const input = { id: randomUUID(), operationId: randomUUID(), version: 0, action: 'submit' as const, fields };
  const [first, again] = await Promise.all([service.mutateCoinage(desk, input), service.mutateCoinage(desk, input)]);
  assert.equal(first.id, again.id); assert.equal(first.version, again.version);
  assert.equal(await db.prisma.coinageEvent.count({ where: { requestId: first.id } }), 1);
  const results = await Promise.allSettled([service.mutateCoinage(accounts, command(first, 'approve')), service.mutateCoinage(accounts, command(first, 'decline', { note: 'Not needed' }))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const before = await db.prisma.coinageRequest.count(); auditFails = true;
  await assert.rejects(create(), /Audit failed/); auditFails = false;
  assert.equal(await db.prisma.coinageRequest.count(), before);
});
test('accounts can take it on, ask for more, and nobody decides their own request', async () => {
  const row = await create();
  const claimed = await service.mutateCoinage(accounts, command(row, 'claim'));
  assert.equal(claimed.handlerId, accounts.id); assert.equal(claimed.status, 'IN_REVIEW');
  const returned = await service.mutateCoinage(accounts, command(claimed, 'information', { note: 'Which till?' }));
  assert.deepEqual(coinageNextActions(returned, desk), ['withdraw']);
  const again = await service.mutateCoinage(colleague, command(returned, 'submit', { fields: { ...fields, forWhom: 'Reception till 3' } }));
  assert.equal(again.status, 'SUBMITTED'); assert.equal(again.creatorId, desk.id);
  await assert.rejects(service.mutateCoinage({ ...desk, review: true }, command(again, 'approve')), /Another accounts colleague/);
  await assert.rejects(service.mutateCoinage(accounts, command(again, 'decline')), /reason/);
});
test('an approved request is ordered once, with dates and a reference, and then cannot change', async () => {
  const approved = await service.mutateCoinage(accounts, command(await create(), 'approve'));
  assert.equal(approved.status, 'APPROVED'); assert.equal(approved.approvedById, accounts.id);
  await assert.rejects(service.mutateCoinage(desk, command(approved, 'order', order)), /permission/);
  await assert.rejects(service.mutateCoinage(accounts, command(approved, 'order', { ...order, deliveryOn: '2026-01-01' })), /on or after/);
  await assert.rejects(service.mutateCoinage(accounts, command(approved, 'order', { ...order, orderReference: '' })), /reference/);
  const input = command(approved, 'order', order);
  const ordered = await service.mutateCoinage(accounts, input), retry = await service.mutateCoinage(accounts, input);
  assert.equal(ordered.status, 'ORDERED'); assert.equal(retry.version, ordered.version);
  for (const action of ['cancel', 'withdraw', 'approve', 'order'] as const) await assert.rejects(service.mutateCoinage({ ...accounts, request: true }, command(ordered, action, { note: 'Change', ...order })));
});
test('an approval not yet ordered can be cancelled with a reason; filters and totals agree', async () => {
  const approved = await service.mutateCoinage(accounts, command(await create({ clubId: 'coin-site-b', forWhom: 'Gym desk FILTER' }), 'approve'));
  await assert.rejects(service.mutateCoinage(accounts, command(approved, 'cancel')), /reason/);
  const cancelled = await service.mutateCoinage(accounts, command(approved, 'cancel', { note: 'Ordered by phone already.' }));
  assert.equal(cancelled.status, 'WITHDRAWN');
  current = accounts; currentGrants = ['coinage.review', 'coinage.process'];
  const matching = await list.listCoinage({ q: 'FILTER', site: 'coin-site-b', status: 'all' });
  assert.equal(matching.total, 1); assert.equal(matching.counts.WITHDRAWN, 1);
  assert.equal((await list.listCoinage({ q: 'FILTER', site: 'coin-site-a', status: 'all' })).total, 0);
  current = desk; currentGrants = ['coinage.request'];
});
test('sending emails accounts (not the requester); later steps email the requester; a failed email never loses the request', async () => {
  mailFails = true;
  const result = await actions.saveCoinage({ id: randomUUID(), operationId: randomUUID(), version: 0, action: 'submit', fields });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.warning, undefined);
  assert.equal(await db.prisma.coinageNotification.count({ where: { requestId: result.id, status: 'FAILED' } }), 1);
  mailFails = false; const previous = sent.length;
  await notifications.deliverCoinageNotifications(result.id, accounts, true);
  assert.equal(sent.length, previous + 1); assert.equal(sent.at(-1)?.email, 'coin-accounts@example.test');
  assert.match(sent.at(-1)!.subject, /^CO-\d{6}: Submitted$/); assert.match(sent.at(-1)!.text, /https:\/\/staff\.example\.test\/coinage\//);
  await notifications.deliverCoinageNotifications(result.id, accounts, true); assert.equal(sent.length, previous + 1);
  const row = await db.prisma.coinageRequest.findUniqueOrThrow({ where: { id: result.id } });
  await service.mutateCoinage(accounts, command(row, 'approve'));
  await notifications.deliverCoinageNotifications(result.id, accounts); assert.equal(sent.at(-1)?.email, 'coin-desk@example.test');
});
test('with nobody in accounts set up the alert waits, visible, and goes once a role is fixed', async () => {
  await db.prisma.staffRole.update({ where: { id: 'coin-accounts-role' }, data: { permissions: [] } });
  const row = await create();
  assert.equal(await db.prisma.coinageNotification.count({ where: { requestId: row.id, recipientId: 'unassigned' } }), 1);
  await notifications.deliverCoinageNotifications(row.id, desk);
  assert.equal(await db.prisma.coinageNotification.count({ where: { requestId: row.id, status: 'FAILED' } }), 1);
  await db.prisma.staffRole.update({ where: { id: 'coin-accounts-role' }, data: { permissions: ['coinage.review', 'coinage.process'] } });
  assert.equal(await notifications.deliverCoinageNotifications(row.id, accounts, true), 0);
  assert.equal(await db.prisma.coinageNotification.count({ where: { requestId: row.id, status: 'SENT' } }), 1);
});
test('home shows accounts what to decide and order, and the desk a way to ask', async () => {
  const viewer = (who: CoinageActor, permissions: string[]) => ({ id: who.id, name: who.name, permissions, anywhere: permissions, isSuperadmin: false });
  const forAccounts = await home.coinageHomeItems(viewer(accounts, ['coinage.review', 'coinage.process']));
  assert.deepEqual(forAccounts.map(item => item.label), ['Coinage requests to decide', 'Approved coinage to order']);
  assert.ok((forAccounts[0].count ?? 0) > 0);
  const forDesk = await home.coinageHomeItems(viewer(desk, ['coinage.request']));
  assert.equal(forDesk.at(-1)?.href, '/coinage/new');
  assert.deepEqual(await home.coinageHomeItems(viewer(desk, [])), []);
});
