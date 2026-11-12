import "server-only";

/** A person's required reading, for Turnfin Me's staff API: what they must
 *  read, one version of it, and acknowledging it. Null while the Docs database
 *  is not configured. The Docs code loads only when it is used. */
export async function docsReading() {
  if (!process.env.DOCS_DATABASE_URL) return null;
  const [{ directoryDatabase }, domain] = await Promise.all([import("@/modules/docs/shared/runtime-database"), import("@/modules/docs/shared/domain")]);
  const db = directoryDatabase();
  return {
    requirements: (userId: string) => domain.requirements(db, userId),
    documentView: (userId: string, documentId: string, versionId: string) => domain.documentView(db, userId, documentId, versionId),
    acknowledge: (userId: string, documentId: string, versionId: string) => new domain.DocumentService(db).acknowledge(userId, documentId, versionId),
  };
}
