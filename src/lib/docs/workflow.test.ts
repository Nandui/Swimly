import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { one, rows, findMember, type Database } from './database';
import { createDocsTestDatabase, demoMatrix } from '@/test/docs-database';
import {
  DocumentService,
  documentView,
  library,
  requirements,
} from './domain';
import { paragraph, matrixSchema, validateBody } from './content';
import { csvCell } from './reporting';
import type { DocumentContent, Snapshot, Draft } from './types';
import { richDocumentExample } from '@/test/docs-rich-content';
let db: Database;
let service: DocumentService;
before(async () => {
  db = await createDocsTestDatabase();
  service = new DocumentService(db);
});
after(async () => {
  await db.close();
});
function content(type: DocumentContent['type'] = 'SOP'): DocumentContent {
  return {
    schemaVersion: 1,
    title: 'Pool handover verification',
    reference: `TEST-${randomUUID().slice(0, 8)}`,
    type,
    summary: 'Handover steps for verification.',
    ownerId: 'jamie',
    facilityIds: ['harbour'],
    teamIds: ['aquatics'],
    reviewDate: '2027-09-16',
    body: {
      type: 'doc',
      content: [paragraph('Check the handover notes before starting the shift.')],
    },
    riskRows: [],
    riskMatrix: null,
    attachments: [],
    relatedIds: [],
  };
}
async function create(c = content()) {
  const id = await service.create('jamie', c);
  const session = randomUUID();
  const d = await service.lock('jamie', id, session);
  return { id, session, d: d!, c };
}
async function publish(c = content()) {
  const f = await create(c);
  const submission = await service.submit(
    'jamie',
    f.id,
    f.session,
    f.d.revision,
    'sam',
    'Initial release',
  );
  const version = await service.review('sam', f.id, submission, 'approved', '');
  return { ...f, submission, version: version! };
}
test('complete draft → request changes → resubmit → publish → acknowledge workflow', async () => {
  const f = await create();
  const saved = await service.save('jamie', f.id, f.session, f.d.revision, {
    ...f.c,
    summary: 'A clearer shift handover.',
  });
  const first = await service.submit(
    'jamie',
    f.id,
    f.session,
    saved.revision,
    'sam',
    'First review',
  );
  await service.review('sam', f.id, first, 'changes_requested', 'Clarify the final step.');
  assert.equal(
    (await one<Draft>(db, 'SELECT * FROM drafts WHERE document_id=$1', [f.id]))?.status,
    'changes_requested',
  );
  const edit = (await service.lock('jamie', f.id, f.session))!;
  const revised = await service.save('jamie', f.id, f.session, edit.revision, {
    ...edit.content,
    body: {
      type: 'doc',
      content: [
        paragraph(
          'Check the handover notes. Confirm any outstanding actions with the duty manager.',
        ),
      ],
    },
  });
  const submission = await service.submit(
    'jamie',
    f.id,
    f.session,
    revised.revision,
    'sam',
    'Clarified final step',
  );
  await service.assign('jamie', f.id, ['riley'], [], '2027-09-20');
  const version = await service.review('sam', f.id, submission, 'approved', 'Clear and ready.');
  const view = await documentView(db, 'riley', f.id);
  assert.equal(view.selected?.id, version);
  assert.equal(view.selected?.version, 1);
  assert.equal(view.draft, undefined);
  await service.acknowledge('riley', f.id, version!);
  const reading = await requirements(db, 'riley');
  assert.equal(reading.find((r) => r.documentId === f.id)?.status, 'completed');
  assert.ok(reading.find((r) => r.documentId === f.id)?.acknowledgedAt);
});
test('draft edits do not change published reading content or expose draft search text', async () => {
  const f = await publish();
  await service.startDraft('jamie', f.id);
  const d = (await service.lock('jamie', f.id, 'edit-next'))!;
  await service.save('jamie', f.id, 'edit-next', d.revision, {
    ...d.content,
    title: 'UNPUBLISHEDMAGICWORD',
  });
  const view = await documentView(db, 'riley', f.id);
  assert.equal(view.selected?.content.title, f.c.title);
  assert.equal(view.draft, undefined);
  assert.ok(
    !(await library(db, 'riley', { query: 'UNPUBLISHEDMAGICWORD' })).some((d) => d.id === f.id),
  );
});
test('all contributors, including administrators, are excluded from self-approval', async () => {
  const f = await create();
  await service.lock('jamie', f.id, f.session, true);
  const a = (await service.lock('alex', f.id, 'admin-edit'))!;
  const saved = await service.save('alex', f.id, 'admin-edit', a.revision, {
    ...a.content,
    summary: 'Administrator contribution',
  });
  await assert.rejects(
    service.submit('alex', f.id, 'admin-edit', saved.revision, 'alex', 'Attempt self-approval'),
    /independent approver/,
  );
  const s = await service.submit(
    'alex',
    f.id,
    'admin-edit',
    saved.revision,
    'sam',
    'Independent review',
  );
  await assert.rejects(service.review('alex', f.id, s, 'approved', ''), /independent approver/);
});
test('reader cannot create, edit, submit, approve, report, or see unpublished documents', async () => {
  const f = await create();
  await assert.rejects(service.create('riley', content()), /authoring permission/);
  await assert.rejects(service.lock('riley', f.id, 'bad'), /authoring permission/);
  await assert.rejects(service.save('riley', f.id, f.session, f.d.revision, f.c), /authoring permission/);
  await assert.rejects(
    service.submit('riley', f.id, f.session, f.d.revision, 'sam', 'bad'),
    /authoring permission/,
  );
  await assert.rejects(service.review('riley', f.id, 'fake', 'approved', ''), /Approver access/);
  await assert.rejects(requirements(db, 'riley', true), /Reporting access/);
  await assert.rejects(documentView(db, 'riley', f.id), /not found/);
});
test('editing leases exclude another user and a second tab from the same user', async () => {
  const f = await create();
  await assert.rejects(service.lock('alex', f.id, 'other'), /is editing/);
  await assert.rejects(service.lock('jamie', f.id, 'other-tab'), /is editing/);
  await assert.rejects(service.save('jamie', f.id, 'other-tab', f.d.revision, f.c), /expired/);
});
test('expired leases and stale revisions fail without overwriting content', async () => {
  const f = await create();
  const saved = await service.save('jamie', f.id, f.session, f.d.revision, {
    ...f.c,
    title: 'First saved title',
  });
  await assert.rejects(
    service.save('jamie', f.id, f.session, f.d.revision, { ...f.c, title: 'Stale write' }),
    /draft has changed/,
  );
  await db.query("UPDATE drafts SET lease_until=now()-interval '1 second' WHERE document_id=$1", [
    f.id,
  ]);
  await assert.rejects(
    service.save('jamie', f.id, f.session, saved.revision, { ...f.c, title: 'Expired write' }),
    /expired/,
  );
  const next = await service.lock('alex', f.id, 'new-lock');
  assert.equal(next?.content.title, 'First saved title');
});
test('submission freezes content and duplicate publication is idempotent', async () => {
  const f = await create();
  const s = await service.submit('jamie', f.id, f.session, f.d.revision, 'sam', 'Ready');
  await assert.rejects(service.lock('jamie', f.id, f.session), /frozen/);
  const [first, second] = await Promise.all([
    service.review('sam', f.id, s, 'approved', ''),
    service.review('sam', f.id, s, 'approved', ''),
  ]);
  assert.equal(first, second);
  assert.equal(
    (
      await rows<Snapshot>(
        db,
        "SELECT * FROM snapshots WHERE document_id=$1 AND kind='publication'",
        [f.id],
      )
    ).length,
    1,
  );
  await assert.rejects(
    service.review('sam', f.id, s, 'changes_requested', 'Too late'),
    /already has a decision/,
  );
});
test('published snapshots, decisions, acknowledgements and audit events are immutable in PostgreSQL', async () => {
  const f = await publish();
  await service.acknowledge('riley', f.id, f.version);
  for (const [table, column, value] of [
    ['snapshots', 'id', f.version],
    ['reviews', 'submission_id', f.submission],
    ['acknowledgements', 'version_id', f.version],
    ['audit_events', 'document_id', f.id],
  ]) {
    await assert.rejects(db.query(`DELETE FROM ${table} WHERE ${column}=$1`, [value]), /immutable/);
  }
  await assert.rejects(
    db.query('UPDATE snapshots SET change_summary=$2 WHERE id=$1', [f.version, 'tamper']),
    /immutable/,
  );
});
test('publication makes fresh assignments, retains past acknowledgements, and rejects stale reads', async () => {
  const f = await publish();
  await service.assign('jamie', f.id, ['riley'], [], null);
  await service.acknowledge('riley', f.id, f.version);
  const restored = await service.startDraft('jamie', f.id);
  await service.lock('jamie', f.id, 'next');
  const s = await service.submit('jamie', f.id, 'next', restored.revision, 'sam', 'New release');
  const next = await service.review('sam', f.id, s, 'approved', '');
  await assert.rejects(service.acknowledge('riley', f.id, f.version), /newer version/);
  const rs = (await requirements(db, 'riley')).filter((r) => r.documentId === f.id);
  assert.equal(rs.find((r) => r.versionId === f.version)?.status, 'completed');
  assert.equal(rs.find((r) => r.versionId === next)?.status, 'outstanding');
  assert.ok(rs.find((r) => r.versionId === f.version)?.acknowledgedAt);
});
test('team joining and leaving reconciles current reading without deleting history', async () => {
  const f = await publish();
  await service.assign('jamie', f.id, [], ['operations'], null);
  const riley = (await findMember(db, 'riley'))!;
  await service.saveMember('alex', { ...riley, teamIds: [...riley.teamIds, 'operations'] });
  assert.equal(
    (await requirements(db, 'riley')).find((r) => r.documentId === f.id)?.status,
    'outstanding',
  );
  await service.saveMember('alex', riley);
  assert.equal(
    (await requirements(db, 'riley')).find((r) => r.documentId === f.id)?.status,
    'cancelled',
  );
  await service.saveMember('alex', { ...riley, teamIds: [...riley.teamIds, 'operations'] });
  await service.acknowledge('riley', f.id, f.version);
  await service.saveMember('alex', riley);
  assert.equal(
    (await requirements(db, 'riley')).find((r) => r.documentId === f.id)?.status,
    'completed',
  );
});
test('removing an assignment cancels open requirements and preserves completed ones', async () => {
  const f = await publish();
  await service.assign('jamie', f.id, ['riley', 'alex'], [], null);
  await service.acknowledge('riley', f.id, f.version);
  await service.assign('jamie', f.id, [], [], null);
  assert.equal(
    (await requirements(db, 'riley')).find((r) => r.documentId === f.id)?.status,
    'completed',
  );
  assert.equal(
    (await requirements(db, 'alex')).find((r) => r.documentId === f.id)?.status,
    'cancelled',
  );
});
test('archive requires owner permission and a reason; history remains available', async () => {
  const f = await publish();
  await service.assign('jamie', f.id, ['riley'], [], null);
  await assert.rejects(service.archive('sam', f.id, 'Retired'), /Only the owner/);
  await assert.rejects(service.archive('jamie', f.id, ''), /archive reason/);
  await service.archive('jamie', f.id, 'Superseded by updated guidance');
  assert.ok(!(await library(db, 'riley')).some((d) => d.id === f.id));
  assert.ok((await library(db, 'riley', { archived: true })).some((d) => d.id === f.id));
  assert.ok((await documentView(db, 'riley', f.id)).selected);
  assert.equal(
    (await requirements(db, 'riley')).find((r) => r.documentId === f.id)?.status,
    'cancelled',
  );
  await assert.rejects(service.startDraft('jamie', f.id), /Archived/);
});
test('risk submission captures the exact configured matrix and preserves historical scores', async () => {
  const c = content('Risk assessment');
  c.riskRows = [
    {
      id: 'hazard',
      hazard: 'Wet surfaces',
      people: 'Staff',
      controls: 'Recorded checks',
      initialLikelihood: 4,
      initialSeverity: 3,
      residualLikelihood: 2,
      residualSeverity: 3,
      actions: 'Check records',
      ownerId: 'jamie',
      dueDate: '2027-09-16',
    },
  ];
  const f = await publish(c);
  await service.saveMatrix('alex', {
    ...demoMatrix,
    bands: [{ label: 'Custom band', min: 1, max: 25, color: 'green' }],
  });
  const snapshot = (await documentView(db, 'riley', f.id)).selected!;
  assert.equal(snapshot.content.riskMatrix?.bands.length, 4);
  assert.equal(
    snapshot.content.riskRows[0].residualLikelihood * snapshot.content.riskRows[0].residualSeverity,
    6,
  );
  await service.saveMatrix('alex', demoMatrix);
});
test('unconfigured and incomplete risk assessments cannot be submitted', async () => {
  const c = content('Risk assessment');
  const f = await create(c);
  await db.query(
    "UPDATE settings SET value=jsonb_set(value,'{configured}','false') WHERE id='matrix'",
  );
  await assert.rejects(
    service.submit('jamie', f.id, f.session, f.d.revision, 'sam', 'Ready'),
    /configure the risk matrix/,
  );
  await service.saveMatrix('alex', demoMatrix);
  await assert.rejects(
    service.submit('jamie', f.id, f.session, f.d.revision, 'sam', 'Ready'),
    /complete hazard/,
  );
  assert.equal(
    matrixSchema.safeParse({
      ...demoMatrix,
      bands: [{ label: 'Gap', min: 2, max: 25, color: 'red' }],
    }).success,
    false,
  );
  assert.equal(
    matrixSchema.safeParse({
      ...demoMatrix,
      bands: [...demoMatrix.bands, { label: 'Overlap', min: 1, max: 5, color: 'red' }],
    }).success,
    false,
  );
});
test('rich formatting survives saving, reopening, approval and restoring a draft', async () => {
  const f = await create();
  const saved = await service.save('jamie', f.id, f.session, f.d.revision, { ...f.c, body: richDocumentExample });
  assert.deepEqual((await documentView(db, 'jamie', f.id)).draft?.content.body, richDocumentExample);
  const submission = await service.submit('jamie', f.id, f.session, saved.revision, 'sam', 'Rich formatting example');
  const version = await service.review('sam', f.id, submission, 'approved', '');
  assert.deepEqual((await documentView(db, 'riley', f.id)).selected?.content.body, richDocumentExample);
  await service.startDraft('jamie', f.id, version!);
  assert.deepEqual((await documentView(db, 'jamie', f.id)).draft?.content.body, richDocumentExample);
});

test('restore creates a draft without replacing the publication and requires reapproval', async () => {
  const f = await publish();
  await service.startDraft('jamie', f.id, f.version);
  const view = await documentView(db, 'jamie', f.id);
  assert.equal(view.selected?.id, f.version);
  assert.equal(view.draft?.status, 'draft');
  assert.match(view.draft?.changeSummary || '', /Restore version 1/);
  await assert.rejects(service.startDraft('jamie', f.id, f.version), /Finish the existing draft/);
});
test('file references, links and rich content are validated before saving', async () => {
  const f = await create();
  await assert.rejects(
    service.save('jamie', f.id, f.session, f.d.revision, {
      ...f.c,
      attachments: [{ id: 'unknown', name: 'file.pdf', mime: 'application/pdf', size: 123 }],
    }),
    /does not belong/,
  );
  assert.throws(
    () =>
      validateBody({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'click',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      }),
    /valid http/,
  );
  assert.throws(() => validateBody({ type: 'doc', content: [{ type: 'script' }] }), /unsupported/);
  assert.throws(
    () =>
      validateBody({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: '/api/docs/files/abc', alt: '' } }],
      }),
    /alternative text/,
  );
});
test('template edits do not rewrite documents already created', async () => {
  const f = await create();
  const before = structuredClone(f.c.body);
  await service.saveTemplate('alex', 'default-sop', 'Changed template', {
    type: 'doc',
    content: [paragraph('New template body')],
  });
  const d = await one<Draft>(db, 'SELECT * FROM drafts WHERE document_id=$1', [f.id]);
  assert.deepEqual(d?.content.body, before);
});
test('CSV output neutralises spreadsheet formulas', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.match(csvCell(' +SUM(1,2)'), /^"'/);
});
test('PostgreSQL full-text search matches content inside the approved body', async () => {
  const c = content();
  c.body = { type: 'doc', content: [paragraph('Uniquequartz handover reference.')] };
  const f = await publish(c);
  assert.ok((await library(db, 'riley', { query: 'Uniquequartz' })).some((d) => d.id === f.id));
});
test('a voluntary acknowledgement satisfies a subsequently assigned same-version requirement', async () => {
  const f = await publish();
  await service.acknowledge('riley', f.id, f.version);
  await service.assign('jamie', f.id, ['riley'], [], null);
  assert.equal(
    (await requirements(db, 'riley')).find((r) => r.documentId === f.id)?.status,
    'completed',
  );
});
