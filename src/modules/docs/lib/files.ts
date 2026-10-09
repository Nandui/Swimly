import { randomUUID } from 'node:crypto';
import { database, one, rows } from './database';
import { actor, DomainError, audit } from './domain';
import { canWrite, type Draft, type Snapshot, type Attachment } from './types';
import { imageIds } from './content';
const MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
];
export function validateFile(name: string, mime: string, bytes: Buffer) {
  if (!MIME.includes(mime) || bytes.length === 0 || bytes.length > 4 * 1024 * 1024)
    throw new DomainError('Use a PDF, DOCX, PNG, JPEG, or WebP file under 4 MB.');
  const valid =
    mime === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : mime === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : mime === 'image/webp'
            ? bytes.subarray(0, 4).toString() === 'RIFF' &&
              bytes.subarray(8, 12).toString() === 'WEBP'
            : bytes.subarray(0, 2).toString() === 'PK' &&
              bytes.includes(Buffer.from('word/document.xml')) &&
              bytes.includes(Buffer.from('[Content_Types].xml'));
  const extension =
    mime === 'application/pdf'
      ? /\.pdf$/i
      : mime.startsWith('application/')
        ? /\.docx$/i
        : mime === 'image/png'
          ? /\.png$/i
          : mime === 'image/jpeg'
            ? /\.jpe?g$/i
            : /\.webp$/i;
  if (!valid || !extension.test(name))
    throw new DomainError('The file contents, extension, and file type must match.');
}
export async function uploadFile(
  who: string,
  documentId: string,
  session: string,
  file: File,
  dbOverride?: import('./database').Database,
): Promise<Attachment> {
  if (file.size > 4 * 1024 * 1024) throw new DomainError('Use a file under 4 MB.', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  validateFile(file.name, file.type, bytes);
  const db = dbOverride ?? await database();
  return db.transaction(async (tx) => {
    const m = await actor(tx, who);
    if (!canWrite(m)) throw new DomainError('Author access required.', 403);
    const d = await one<Draft>(tx, 'SELECT * FROM drafts WHERE document_id=$1', [documentId]);
    if (
      !d ||
      d.status === 'in_review' ||
      d.leaseOwner !== who ||
      d.leaseSession !== session ||
      new Date(d.leaseUntil || 0).getTime() <= Date.now()
    )
      throw new DomainError('Acquire an editing session before uploading.', 409);
    if (
      await one(tx, 'SELECT id FROM documents WHERE id=$1 AND archived_at IS NOT NULL', [
        documentId,
      ])
    )
      throw new DomainError('This document is archived.');
    const id = randomUUID();
    const key = `${documentId}/${id}`;
    const name = file.name.replace(/[\x00-\x1f\/\\]/g, '_').slice(0, 200);
    await tx.query(
      'INSERT INTO attachments(id,document_id,name,mime,size,storage_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, documentId, name, file.type, bytes.length, key, who],
    );
    await tx.query('INSERT INTO attachment_blobs(id,bytes) VALUES($1,$2)', [id, bytes]);
    await audit(tx, who, documentId, 'file_uploaded', name);
    return { id, name, mime: file.type, size: bytes.length };
  });
}
export async function readAttachment(who: string, id: string, dbOverride?: import('./database').Database) {
  const db = dbOverride ?? await database();
  const m = await actor(db, who);
  const file = await one<Attachment & { documentId: string; storageKey: string }>(
    db,
    'SELECT * FROM attachments WHERE id=$1',
    [id],
  );
  if (!file) throw new DomainError('File not found.', 404);
  if (!canWrite(m)) {
    const snapshots = await rows<Snapshot>(
      db,
      "SELECT * FROM snapshots WHERE document_id=$1 AND kind='publication'",
      [file.documentId],
    );
    if (
      !snapshots.some(
        (s) =>
          s.content.attachments.some((a) => a.id === id) || imageIds(s.content.body).includes(id),
      )
    )
      throw new DomainError('File not found.', 404);
  }
  const blob = await one<{ bytes: Buffer }>(db, 'SELECT bytes FROM attachment_blobs WHERE id=$1', [id]);
  if (!blob) throw new DomainError('File not found.', 404);
  return { file, bytes: Buffer.from(blob.bytes) };
}
