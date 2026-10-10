import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { prisma } from "@/lib/prisma";
import { postgresConnectionString } from "@/lib/postgres-connection";
import { validateBody } from "@/modules/docs/shared/content";
import { findMember, type Database, type Sql } from "@/modules/docs/shared/database";
import { canApprove, canWrite } from "@/modules/docs/shared/types";
import { DocumentService } from "@/modules/docs/shared/domain";
import { parseNotionPage, type NotionPage } from "@/modules/docs/features/import";
import { staffDirectory } from "@/modules/docs/shared/staff-directory-data";
import { docsStorageConfig } from "@/modules/docs/shared/storage-config";

/** Brings a Notion document register into Turnfin Docs (docs/turnfin-docs.md).
 *
 *  Reads a Notion Markdown export (unzipped: one .md file per page; pages
 *  whose title starts with a reference such as "[OPS-BT-PO-SOP-01]"). Each
 *  page becomes a Docs document for the chosen site. A page tagged Draft in
 *  Notion stays a draft; any other is submitted by --author and approved by
 *  --approver, through the same steps and audit as in the app, so it is
 *  published and readable. A reference already in Docs is skipped, so the
 *  import can run again. Dry run by default; prints counts and titles only.
 *
 *    npm run prod -- scripts/docs-import-notion.ts "C:\path\Export" --site Bishopstown
 *    npm run prod -- scripts/docs-import-notion.ts "C:\path\Export" --site Bishopstown --author a@x --approver b@x --confirm */

function args() {
  const out = { folder: "", site: "Bishopstown", author: "", approver: "", confirm: false };
  const list = process.argv.slice(2);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === "--confirm") out.confirm = true;
    else if (a === "--site") out.site = list[++i] ?? "";
    else if (a === "--author") out.author = (list[++i] ?? "").toLowerCase();
    else if (a === "--approver") out.approver = (list[++i] ?? "").toLowerCase();
    else if (!a.startsWith("--") && !out.folder) out.folder = a;
  }
  return out;
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? markdownFiles(path) : /\.md$/i.test(name) ? [path] : [];
  });
}

function openDocs(): Database & { end(): Promise<void> } {
  const pool = new Pool({ connectionString: postgresConnectionString(docsStorageConfig(process.env).runtime), max: 2 });
  const sql = (client: PoolClient): Sql => ({ staff: staffDirectory, query: async <T,>(statement: string, params?: unknown[]) => ({ rows: (await client.query<QueryResultRow>(statement, params)).rows as T[] }) });
  const transaction = async <T,>(fn: (tx: Sql) => Promise<T>, lock: boolean) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path = turnfin_docs");
      if (lock) await client.query("SELECT id FROM workspace_lock WHERE id=1 FOR UPDATE");
      const result = await fn(sql(client));
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  };
  return {
    staff: staffDirectory,
    query: (statement, params) => transaction((tx) => tx.query(statement, params), false),
    transaction: (fn) => transaction(fn, true),
    close: async () => {},
    end: () => pool.end(),
  };
}

async function main() {
  const opts = args();
  if (!opts.folder) throw new Error("Pass the folder of the unzipped Notion export.");
  const pages: { file: string; page: NotionPage }[] = [];
  const problems: string[] = [];
  for (const file of markdownFiles(opts.folder)) {
    const text = readFileSync(file, "utf8");
    if (!/^#\s+\\?\[[A-Z]{2,}-/m.test(text) && !/<content>/.test(text)) continue; // the register's own index page
    try {
      const page = parseNotionPage(text, file.split(/[\\/]/).pop());
      validateBody(page.body);
      pages.push({ file, page });
    } catch (error) {
      problems.push(`${file.split(/[\\/]/).pop()}: ${(error as Error).message}`);
    }
  }
  const site = await prisma.club.findFirst({ where: { name: { contains: opts.site, mode: "insensitive" }, archivedAt: null }, select: { id: true, name: true } });
  if (!site) throw new Error(`No open site matches "${opts.site}".`);

  const docs = openDocs();
  try {
    const existing = new Set((await docs.query<{ reference: string }>(
      "SELECT content->>'reference' AS reference FROM drafts UNION SELECT content->>'reference' FROM snapshots",
    )).rows.map((r) => r.reference));
    const fresh = pages.filter((p) => !existing.has(p.page.reference));
    const count = (pred: (p: NotionPage) => boolean) => fresh.filter((p) => pred(p.page)).length;
    console.log(`${pages.length} Notion pages read for ${site.name}; ${pages.length - fresh.length} already in Docs.`);
    console.log(`To import: ${fresh.length} (${count((p) => !p.draft)} to publish, ${count((p) => p.draft)} as drafts). Types: NOP ${count((p) => p.type === "NOP")}, SOP ${count((p) => p.type === "SOP")}, EAP ${count((p) => p.type === "EAP")}, other ${count((p) => p.type === "Custom")}.`);
    for (const p of problems) console.log(`  Could not read: ${p}`);
    if (!opts.confirm) return console.log("Dry run. Pass --author <email> --approver <email> --confirm to import.");

    const [author, approver] = await Promise.all([opts.author, opts.approver].map((email) => prisma.user.findFirst({ where: { email, isActive: true }, select: { id: true, name: true } })));
    if (!author) throw new Error("Pass --author <email> of an active account that can write documents.");
    if (!approver || approver.id === author.id) throw new Error("Pass --approver <email> of a different active account that can approve documents.");
    // Check both before touching anything, so a refusal never leaves half an import.
    const [asAuthor, asApprover] = await Promise.all([findMember(docs, author.id), findMember(docs, approver.id)]);
    if (!asAuthor || !canWrite(asAuthor)) throw new Error(`${author.name} cannot write documents in Docs.`);
    if (!asApprover || !canApprove(asApprover)) throw new Error(`${approver.name} cannot approve documents in Docs.`);
    const service = new DocumentService(docs);
    let published = 0, drafted = 0;
    // A page not tagged Draft that an earlier run created but did not publish is finished now.
    const unpublished = new Map((await docs.query<{ id: string; reference: string }>(
      "SELECT d.document_id AS id, d.content->>'reference' AS reference FROM drafts d JOIN documents doc ON doc.id=d.document_id WHERE doc.current_version_id IS NULL AND d.status='draft' AND doc.created_by=$1",
      [author.id],
    )).rows.map((r) => [r.reference, r.id]));
    const publish = async (id: string) => {
      // An earlier run of this import may have left its own editing lease behind.
      await docs.query("UPDATE drafts SET lease_owner=null, lease_session=null, lease_until=null WHERE document_id=$1 AND lease_owner=$2 AND status='draft'", [id, author.id]);
      const session = randomUUID();
      const draft = await service.lock(author.id, id, session);
      const submission = await service.submit(author.id, id, session, draft!.revision, approver.id, `Imported from the Notion ${site.name} NOP & SOP register.`);
      await service.review(approver.id, id, submission, "approved", "");
    };
    let finished = 0;
    for (const { page } of pages) {
      const id = unpublished.get(page.reference);
      if (id && !page.draft) { await publish(id); finished++; }
    }
    for (const { page } of fresh) {
      const content = {
        schemaVersion: 1 as const, title: page.title, reference: page.reference, type: page.type, summary: page.summary,
        ownerId: author.id, facilityIds: [site.id], teamIds: [], reviewDate: page.reviewDate, body: page.body,
        riskRows: [], riskMatrix: null, relatedIds: [], attachments: [],
      };
      const id = await service.create(author.id, content);
      if (page.draft) { drafted++; continue; }
      await publish(id);
      published++;
    }
    console.log(`Imported ${published + drafted}: ${published} published (approved by ${approver.name}), ${drafted} left as drafts.${finished ? ` Finished publishing ${finished} from an earlier run.` : ""}`);
  } finally {
    await docs.end();
  }
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
