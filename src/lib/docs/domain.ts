import { randomUUID } from 'node:crypto';
import type { Database, Sql } from './database';
import { one, rows, findMember, listMembers } from './database';
import { expandPermissions } from '@/lib/staff/permissions';
import { visibleScreens } from '@/lib/staff/screens';
import {
  contentSchema,
  validateBody,
  contentSearch,
  imageIds,
  matrixSchema,
  plainText,
} from './content';
import {
  canWrite,
  canRead,
  canManage,
  canApprove,
  type Member,
  type DocumentContent,
  type Draft,
  type Snapshot,
  type DocumentRecord,
  type LibraryDocument,
  type AssignmentRule,
  type Requirement,
  type RiskMatrix,
  type Group,
} from './types';

export class DomainError extends Error {
  constructor(
    message: string,
    public code = 400,
  ) {
    super(message);
  }
}
function fail(message: string, code = 400): never {
  throw new DomainError(message, code);
}
export async function actor(tx: Sql, id: string) {
  const m = await findMember(tx, id);
  if (!m?.active) fail('Please sign in with an active staff account.', 401);
  if (tx.access?.id === id) {
    const effective = expandPermissions(tx.access.permissions);
    const screens = visibleScreens(tx.access.screens, effective);
    m.screens = [...visibleScreens(m.screens, expandPermissions(m.permissions))].filter(key => screens.has(key));
    m.permissions = [...expandPermissions(m.permissions)].filter(key => effective.has(key));
  }
  if (!canRead(m)) fail('Docs access is required.', 403);
  return m;
}
const author = (m: Member) => {
  if (!canWrite(m)) fail('Document authoring permission is required.', 403);
};
const admin = (m: Member) => {
  if (!canManage(m)) fail('Docs administration permission is required.', 403);
};
export async function audit(
  tx: Sql,
  who: string,
  documentId: string | null,
  action: string,
  detail: string,
) {
  await tx.query(
    'INSERT INTO audit_events(id,actor_id,document_id,action,detail) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), who, documentId, action, detail],
  );
}
async function doc(tx: Sql, id: string) {
  return (
    (await one<DocumentRecord>(tx, 'SELECT * FROM documents WHERE id=$1', [id])) ||
    fail('Document not found.', 404)
  );
}
async function draft(tx: Sql, id: string) {
  return (
    (await one<Draft>(tx, 'SELECT * FROM drafts WHERE document_id=$1', [id])) ||
    fail('No editable draft exists.', 404)
  );
}
function lease(d: Draft, who: string, session: string) {
  if (
    d.leaseOwner !== who ||
    d.leaseSession !== session ||
    !d.leaseUntil ||
    new Date(d.leaseUntil).getTime() <= Date.now()
  )
    fail(
      'Your editing session expired or another editor has the document. Reconnect before saving.',
      409,
    );
}
async function checkContent(tx: Sql, documentId: string, input: unknown) {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) fail(parsed.error.issues[0]?.message || 'Check the document fields.');
  const c = parsed.data as DocumentContent;
  try {
    validateBody(c.body);
  } catch (e) {
    fail((e as Error).message);
  }
  const owner = await actor(tx, c.ownerId);
  if (!canWrite(owner)) fail('Choose a document owner with authoring permission.');
  for (const [kind, values] of [
    ['facility', c.facilityIds],
    ['team', c.teamIds],
  ] as const) {
    const found = await rows<Group>(
      tx,
      'SELECT id,name FROM groups WHERE kind=$1 AND id=ANY($2::text[])',
      [kind, values],
    );
    if (found.length !== new Set(values).size) fail(`Choose valid ${kind} entries.`);
  }
  const duplicate = await one(
    tx,
    "SELECT d.id FROM documents d LEFT JOIN snapshots s ON s.id=d.current_version_id LEFT JOIN drafts dr ON dr.document_id=d.id WHERE d.id<>$1 AND (lower(s.content->>'reference')=lower($2) OR lower(dr.content->>'reference')=lower($2))",
    [documentId, c.reference.trim()],
  );
  if (duplicate) fail('That document reference is already in use.');
  for (const id of c.relatedIds)
    if (
      id === documentId ||
      !(await one(tx, 'SELECT id FROM documents WHERE id=$1 AND current_version_id IS NOT NULL', [
        id,
      ]))
    )
      fail('Choose a different published related document.');
  const attachmentIds = [...new Set([...c.attachments.map((a) => a.id), ...imageIds(c.body)])];
  const attachments = await rows<{ id: string; name: string; mime: string; size: number }>(
    tx,
    'SELECT id,name,mime,size FROM attachments WHERE document_id=$1 AND id=ANY($2::text[])',
    [documentId, attachmentIds],
  );
  if (attachments.length !== attachmentIds.length)
    fail('One of the attachments does not belong to this document.');
  c.attachments = c.attachments.map((a) => attachments.find((v) => v.id === a.id)!);
  c.reference = c.reference.trim();
  c.title = c.title.trim();
  return c;
}
export async function reconcile(tx: Sql, documentId?: string) {
  const rules = await rows<
    AssignmentRule & { currentVersionId: string | null; archivedAt: string | null }
  >(
    tx,
    'SELECT r.*,d.current_version_id,d.archived_at FROM assignment_rules r JOIN documents d ON d.id=r.document_id' +
      (documentId ? ' WHERE d.id=$1' : ''),
    documentId ? [documentId] : [],
  );
  const people = (await listMembers(tx)).filter(canRead);
  for (const rule of rules) {
    const targets = rule.archivedAt
      ? []
      : people
          .filter(
            (m) => rule.memberIds.includes(m.id) || m.teamIds.some((t) => rule.teamIds.includes(t)),
          )
          .map((m) => m.id);
    await tx.query(
      "UPDATE requirements SET status='cancelled' WHERE document_id=$1 AND status='outstanding' AND (version_id IS DISTINCT FROM $2 OR NOT(member_id=ANY($3::text[])))",
      [rule.documentId, rule.currentVersionId, targets],
    );
    if (!rule.currentVersionId) continue;
    for (const id of targets)
      await tx.query(
        "INSERT INTO requirements(id,document_id,version_id,member_id,due_date,status) VALUES($1,$2,$3,$4,$5,CASE WHEN EXISTS(SELECT 1 FROM acknowledgements WHERE version_id=$3 AND member_id=$4) THEN 'completed' ELSE 'outstanding' END) ON CONFLICT(version_id,member_id) DO UPDATE SET due_date=excluded.due_date,status=CASE WHEN requirements.status='completed' THEN 'completed' ELSE excluded.status END",
        [randomUUID(), rule.documentId, rule.currentVersionId, id, rule.dueDate],
      );
  }
}
export class DocumentService {
  constructor(public db: Database) {}
  async create(who: string, input: unknown) {
    return this.db.transaction(async (tx) => {
      author(await actor(tx, who));
      const id = randomUUID();
      const c = await checkContent(tx, id, input);
      await tx.query('INSERT INTO documents(id,created_by) VALUES($1,$2)', [id, who]);
      await tx.query('INSERT INTO drafts(document_id,content,contributors) VALUES($1,$2,$3)', [
        id,
        JSON.stringify(c),
        [who],
      ]);
      await tx.query('INSERT INTO assignment_rules(document_id) VALUES($1)', [id]);
      await audit(tx, who, id, 'created', c.title);
      return id;
    });
  }
  async startDraft(who: string, id: string, versionId?: string) {
    return this.db.transaction(async (tx) => {
      author(await actor(tx, who));
      const document = await doc(tx, id);
      if (document.archivedAt) fail('Archived documents cannot be edited.');
      const existing = await one<Draft>(tx, 'SELECT * FROM drafts WHERE document_id=$1', [id]);
      if (existing) {
        if (versionId) fail('Finish the existing draft before restoring another version.', 409);
        return existing;
      }
      const source = await one<Snapshot>(
        tx,
        "SELECT * FROM snapshots WHERE id=$1 AND document_id=$2 AND kind='publication'",
        [versionId || document.currentVersionId, id],
      );
      if (!source) fail('Published version not found.', 404);
      await tx.query(
        'INSERT INTO drafts(document_id,content,contributors,change_summary) VALUES($1,$2,$3,$4)',
        [
          id,
          JSON.stringify(source.content),
          [who],
          versionId ? `Restore version ${source.version}` : '',
        ],
      );
      await audit(
        tx,
        who,
        id,
        versionId ? 'restored_to_draft' : 'draft_started',
        versionId ? `Restored version ${source.version} for review` : 'Started a new revision',
      );
      return draft(tx, id);
    });
  }
  async lock(who: string, id: string, session: string, release = false) {
    return this.db.transaction(async (tx) => {
      author(await actor(tx, who));
      const document = await doc(tx, id);
      if (document.archivedAt) fail('This document is archived.');
      const d = await draft(tx, id);
      if (!session || session.length > 100) fail('Invalid editing session.');
      if (release) {
        if (d.leaseOwner !== who || d.leaseSession !== session) return null;
        await tx.query(
          'UPDATE drafts SET lease_owner=null,lease_session=null,lease_until=null WHERE document_id=$1 AND lease_owner=$2 AND lease_session=$3',
          [id, who, session],
        );
        await audit(tx, who, id, 'editing_released', 'Released the document editing session');
        return null;
      }
      if (d.status === 'in_review') fail('This revision is frozen for review.', 409);
      if (
        d.leaseUntil &&
        new Date(d.leaseUntil).getTime() > Date.now() &&
        (d.leaseOwner !== who || d.leaseSession !== session)
      ) {
        const person = await actor(tx, d.leaseOwner!);
        fail(`${person.name} is editing this document. Try again after they finish.`, 409);
      }
      await tx.query(
        "UPDATE drafts SET lease_owner=$2,lease_session=$3,lease_until=now()+interval '2 minutes' WHERE document_id=$1",
        [id, who, session],
      );
      await audit(tx, who, id, 'editing_session', 'Acquired or renewed the document editing session');
      return draft(tx, id);
    });
  }
  async save(who: string, id: string, session: string, expected: number, input: unknown) {
    return this.db.transaction(async (tx) => {
      author(await actor(tx, who));
      if ((await doc(tx, id)).archivedAt) fail('This document is archived.');
      const d = await draft(tx, id);
      lease(d, who, session);
      if (d.status === 'in_review') fail('The submitted revision is frozen.', 409);
      if (d.revision !== expected)
        fail(
          'This draft has changed. Reopen it before saving; your unsaved changes are still in this tab.',
          409,
        );
      const c = await checkContent(tx, id, input);
      await tx.query(
        'UPDATE drafts SET content=$2,contributors=$3,revision=revision+1,updated_at=now() WHERE document_id=$1',
        [id, JSON.stringify(c), [...new Set([...d.contributors, who])]],
      );
      await audit(tx, who, id, 'draft_saved', `Saved draft revision ${d.revision + 1}`);
      return draft(tx, id);
    });
  }
  async submit(
    who: string,
    id: string,
    session: string,
    expected: number,
    approverId: string,
    summary: string,
  ) {
    return this.db.transaction(async (tx) => {
      author(await actor(tx, who));
      if ((await doc(tx, id)).archivedAt) fail('This document is archived.');
      const d = await draft(tx, id);
      lease(d, who, session);
      if (d.revision !== expected || d.status === 'in_review')
        fail('The draft changed. Refresh before submitting.', 409);
      const reviewer = await actor(tx, approverId);
      if (!canApprove(reviewer) || d.contributors.includes(approverId))
        fail('Choose an independent approver who has not edited this revision.');
      if (!summary.trim() || summary.length > 2000)
        fail('Add a change summary (up to 2,000 characters).');
      const c = await checkContent(tx, id, d.content);
      if (!c.reviewDate || !c.summary.trim() || !plainText(c.body).trim())
        fail('Add a summary, review date, and document content before submitting.');
      if (c.type === 'Risk assessment') {
        const setting = await one<{ value: RiskMatrix }>(
          tx,
          "SELECT value FROM settings WHERE id='matrix'",
        );
        if (!setting?.value.configured)
          fail('An administrator must configure the risk matrix first.');
        c.riskMatrix = matrixSchema.parse(setting.value);
        if (
          !c.riskRows.length ||
          c.riskRows.some((r) => !r.hazard.trim() || !r.people.trim() || !r.controls.trim())
        )
          fail('Each risk assessment needs complete hazard, people, and controls fields.');
        for (const risk of c.riskRows)
          if (
            risk.actions.trim() &&
            (!risk.ownerId ||
              !risk.dueDate ||
              !(await findMember(tx, risk.ownerId))?.active)
          )
            fail('Additional risk actions need an active owner and due date.');
      } else {
        c.riskRows = [];
        c.riskMatrix = null;
      }
      const snapshotId = randomUUID();
      await tx.query(
        "INSERT INTO snapshots(id,document_id,kind,content,contributors,change_summary,author_id,approver_id) VALUES($1,$2,'submission',$3,$4,$5,$6,$7)",
        [snapshotId, id, JSON.stringify(c), d.contributors, summary.trim(), who, approverId],
      );
      await tx.query(
        "UPDATE drafts SET status='in_review',content=$2,change_summary=$3,approver_id=$4,submission_id=$5,lease_owner=null,lease_session=null,lease_until=null,revision=revision+1,updated_at=now() WHERE document_id=$1",
        [id, JSON.stringify(c), summary.trim(), approverId, snapshotId],
      );
      await audit(tx, who, id, 'submitted', summary.trim());
      return snapshotId;
    });
  }
  async review(
    who: string,
    id: string,
    submissionId: string,
    decision: 'approved' | 'changes_requested',
    feedback: string,
  ) {
    return this.db.transaction(async (tx) => {
      const m = await actor(tx, who);
      if (!canApprove(m)) fail('Approver access is required.', 403);
      const document = await doc(tx, id);
      if (document.archivedAt) fail('This document is archived.');
      const s = await one<Snapshot>(
        tx,
        "SELECT * FROM snapshots WHERE id=$1 AND document_id=$2 AND kind='submission'",
        [submissionId, id],
      );
      if (!s) fail('Submission not found.', 404);
      if (s.approverId !== who || s.contributors.includes(who))
        fail('Only the assigned independent approver can decide this revision.', 403);
      const prior = await one<{ decision: string }>(
        tx,
        'SELECT decision FROM reviews WHERE submission_id=$1',
        [submissionId],
      );
      if (prior) {
        if (prior.decision !== decision) fail('This submission already has a decision.', 409);
        return (
          (
            await one<Snapshot>(
              tx,
              "SELECT * FROM snapshots WHERE submission_id=$1 AND kind='publication'",
              [submissionId],
            )
          )?.id || null
        );
      }
      const d = await draft(tx, id);
      if (d.submissionId !== submissionId || d.status !== 'in_review')
        fail('This submission is no longer awaiting review.', 409);
      if (decision === 'changes_requested' && !feedback.trim())
        fail('Explain what needs to change.');
      if (feedback.length > 5000) fail('Keep feedback below 5,000 characters.');
      await tx.query(
        'INSERT INTO reviews(id,submission_id,reviewer_id,decision,feedback) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), submissionId, who, decision, feedback.trim()],
      );
      if (decision === 'changes_requested') {
        await tx.query(
          "UPDATE drafts SET status='changes_requested',feedback=$2,revision=revision+1,updated_at=now() WHERE document_id=$1",
          [id, feedback.trim()],
        );
        await audit(tx, who, id, 'changes_requested', feedback.trim());
        return null;
      }
      const version = (await one<{ number: number }>(
        tx,
        'SELECT coalesce(max(version),0)+1 AS number FROM snapshots WHERE document_id=$1',
        [id],
      ))!.number;
      const versionId = randomUUID();
      await tx.query(
        "INSERT INTO snapshots(id,document_id,version,kind,content,contributors,change_summary,author_id,approver_id,submission_id) VALUES($1,$2,$3,'publication',$4,$5,$6,$7,$8,$9)",
        [
          versionId,
          id,
          version,
          JSON.stringify(s.content),
          s.contributors,
          s.changeSummary,
          s.authorId,
          who,
          submissionId,
        ],
      );
      await tx.query('UPDATE documents SET current_version_id=$2,search_text=$3 WHERE id=$1', [
        id,
        versionId,
        contentSearch(s.content),
      ]);
      await tx.query('DELETE FROM drafts WHERE document_id=$1', [id]);
      await reconcile(tx, id);
      await audit(tx, who, id, 'published', `Version ${version}: ${s.changeSummary}`);
      return versionId;
    });
  }
  async assign(
    who: string,
    id: string,
    memberIds: string[],
    teamIds: string[],
    dueDate: string | null,
  ) {
    return this.db.transaction(async (tx) => {
      const m = await actor(tx, who);
      author(m);
      const document = await doc(tx, id);
      const d = await one<Draft>(tx, 'SELECT * FROM drafts WHERE document_id=$1', [id]);
      const s = await one<Snapshot>(tx, 'SELECT * FROM snapshots WHERE id=$1', [
        document.currentVersionId,
      ]);
      if (!canManage(m) && (s?.content.ownerId || d?.content.ownerId) !== who)
        fail('Only the document owner or an administrator can assign reading.', 403);
      if (document.archivedAt) fail('Archived documents cannot be assigned.');
      if (memberIds.length > 500 || teamIds.length > 100) fail('Too many assignment targets.');
      for (const person of memberIds) await actor(tx, person);
      for (const team of teamIds)
        if (!(await one(tx, "SELECT id FROM groups WHERE id=$1 AND kind='team'", [team])))
          fail('Unknown team.');
      if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))))
        fail('Invalid reading deadline.');
      await tx.query(
        'INSERT INTO assignment_rules VALUES($1,$2,$3,$4) ON CONFLICT(document_id) DO UPDATE SET member_ids=$2,team_ids=$3,due_date=$4',
        [id, [...new Set(memberIds)], [...new Set(teamIds)], dueDate],
      );
      await reconcile(tx, id);
      await audit(tx, who, id, 'reading_assigned', 'Updated required-reading audience');
    });
  }
  async acknowledge(who: string, id: string, versionId: string) {
    return this.db.transaction(async (tx) => {
      await actor(tx, who);
      const document = await doc(tx, id);
      if (document.archivedAt) fail('This document has been archived.', 409);
      if (document.currentVersionId !== versionId)
        fail(
          'A newer version has been published. Open the current document before acknowledging it.',
          409,
        );
      await tx.query(
        'INSERT INTO acknowledgements(id,version_id,member_id) VALUES($1,$2,$3) ON CONFLICT(version_id,member_id) DO NOTHING',
        [randomUUID(), versionId, who],
      );
      await tx.query(
        "UPDATE requirements SET status='completed' WHERE version_id=$1 AND member_id=$2",
        [versionId, who],
      );
      await audit(tx, who, id, 'acknowledged', `Read published version ${versionId}`);
    });
  }
  async archive(who: string, id: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const m = await actor(tx, who);
      author(m);
      const document = await doc(tx, id);
      const s = await one<Snapshot>(tx, 'SELECT * FROM snapshots WHERE id=$1', [
        document.currentVersionId,
      ]);
      const d = await one<Draft>(tx, 'SELECT * FROM drafts WHERE document_id=$1', [id]);
      if (!canManage(m) && (s?.content.ownerId || d?.content.ownerId) !== who)
        fail('Only the owner or an administrator can archive this document.', 403);
      if (!reason.trim() || reason.length > 2000)
        fail('Add an archive reason (up to 2,000 characters).');
      await tx.query('UPDATE documents SET archived_at=now(),archive_reason=$2 WHERE id=$1', [
        id,
        reason.trim(),
      ]);
      await tx.query(
        'UPDATE drafts SET lease_owner=null,lease_session=null,lease_until=null WHERE document_id=$1',
        [id],
      );
      await reconcile(tx, id);
      await audit(tx, who, id, 'archived', reason.trim());
    });
  }
  async saveMember(who: string, member: Pick<Member, 'id' | 'facilityIds' | 'teamIds'>) {
    return this.db.transaction(async tx => {
      admin(await actor(tx, who));
      const existing = await actor(tx, member.id);
      for (const [kind, values] of [['facility', member.facilityIds], ['team', member.teamIds]] as const)
        for (const id of values)
          if (!(await one(tx, 'SELECT id FROM groups WHERE id=$1 AND kind=$2', [id, kind]))) fail('Unknown document group.');
      await tx.query('INSERT INTO member_profiles(id,facility_ids,team_ids) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET facility_ids=$2,team_ids=$3', [member.id, [...new Set(member.facilityIds)], [...new Set(member.teamIds)]]);
      await reconcile(tx);
      await audit(tx, who, null, 'membership_updated', 'Updated document groups for ' + existing.name);
    });
  }
  async saveGroup(who: string, kind: 'facility' | 'team', name: string, id?: string) {
    return this.db.transaction(async (tx) => {
      admin(await actor(tx, who));
      if (!['facility', 'team'].includes(kind) || !name.trim() || name.length > 100)
        fail('Provide a valid group name.');
      await tx.query(
        'INSERT INTO groups(id,kind,name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
        [id || randomUUID(), kind, name.trim()],
      );
      await audit(tx, who, null, 'group_updated', `${kind}: ${name}`);
    });
  }
  async saveMatrix(who: string, input: unknown) {
    return this.db.transaction(async (tx) => {
      admin(await actor(tx, who));
      const result = matrixSchema.safeParse(input);
      if (!result.success) fail(result.error.issues[0].message);
      await tx.query(
        "INSERT INTO settings VALUES('matrix',$1) ON CONFLICT(id) DO UPDATE SET value=$1",
        [JSON.stringify({ ...result.data, configured: true })],
      );
      await audit(tx, who, null, 'matrix_updated', 'Updated risk matrix for future submissions');
    });
  }
  async saveTemplate(who: string, id: string, name: string, body: DocumentContent['body']) {
    return this.db.transaction(async (tx) => {
      admin(await actor(tx, who));
      if (!name.trim() || name.length > 150) fail('Add a template name.');
      validateBody(body);
      if (imageIds(body).length)
        fail('Template images are not supported; add them to the document after creation.');
      await tx.query('UPDATE templates SET name=$2,body=$3 WHERE id=$1', [
        id,
        name.trim(),
        JSON.stringify(body),
      ]);
      await audit(tx, who, null, 'template_updated', name);
    });
  }
}
export async function library(
  db: Sql,
  who: string,
  options: { query?: string; archived?: boolean } = {},
) {
  const m = await actor(db, who);
  const conditions = ['d.archived_at IS ' + (options.archived ? 'NOT NULL' : 'NULL')];
  const values: unknown[] = [];
  if (!canWrite(m)) conditions.push('s.id IS NOT NULL');
  if (options.query?.trim()) {
    values.push(options.query.trim());
    conditions.push(
      `(d.search_vector @@ websearch_to_tsquery('english',$${values.length}) OR s.content->>'title' ILIKE '%'||$${values.length}||'%' OR s.content->>'reference' ILIKE '%'||$${values.length}||'%'${canWrite(m) ? ` OR dr.content->>'title' ILIKE '%'||$${values.length}||'%' OR dr.content->>'reference' ILIKE '%'||$${values.length}||'%'` : ''})`,
    );
  }
  return rows<LibraryDocument>(
    db,
    `SELECT d.*,coalesce(s.content,dr.content) AS content,s.version,s.created_at AS published_at${canWrite(m) ? ',dr.status AS draft_status,dr.updated_at AS draft_updated_at' : ''} FROM documents d LEFT JOIN snapshots s ON s.id=d.current_version_id LEFT JOIN drafts dr ON dr.document_id=d.id WHERE ${conditions.join(' AND ')} ORDER BY s.created_at DESC NULLS LAST,d.created_at DESC`,
    values,
  );
}
export async function requirements(db: Sql, who: string, all = false) {
  const m = await actor(db, who);
  if (all && !canWrite(m)) fail('Reporting access requires an author role.', 403);
  return rows<Requirement>(
    db,
    `SELECT r.*,a.created_at AS acknowledged_at,s.content->>'title' AS title,s.content->>'reference' AS reference,s.version,s.content->'facilityIds' AS facility_ids,s.content->'teamIds' AS team_ids FROM requirements r JOIN snapshots s ON s.id=r.version_id LEFT JOIN acknowledgements a ON a.version_id=r.version_id AND a.member_id=r.member_id ${all ? '' : 'WHERE r.member_id=$1'} ORDER BY s.created_at DESC`,
    all ? [] : [who],
  );
}
export async function documentView(db: Sql, who: string, id: string, versionId?: string) {
  const m = await actor(db, who);
  const document = await doc(db, id);
  const snapshots = await rows<Snapshot>(
    db,
    'SELECT * FROM snapshots WHERE document_id=$1' +
      (canWrite(m) ? '' : " AND kind='publication'") +
      ' ORDER BY created_at DESC,id DESC',
    [id],
  );
  const selected = snapshots.find((s) => s.id === (versionId || document.currentVersionId));
  const d = canWrite(m)
    ? await one<Draft>(db, 'SELECT * FROM drafts WHERE document_id=$1', [id])
    : undefined;
  if (versionId && !selected) fail('Version not found.', 404);
  if (!selected && !d) fail('Published document not found.', 404);
  const ack = selected
    ? await one<{ createdAt: string }>(
        db,
        'SELECT created_at FROM acknowledgements WHERE version_id=$1 AND member_id=$2',
        [selected.id, who],
      )
    : undefined;
  const assignments = canWrite(m)
    ? await one<AssignmentRule>(db, 'SELECT * FROM assignment_rules WHERE document_id=$1', [id])
    : undefined;
  return {
    document,
    snapshots,
    selected,
    draft: d,
    acknowledgedAt: ack?.createdAt || null,
    assignments,
  };
}
