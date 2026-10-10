/** Log the failure category without exporting document text or staff details. */
export async function reportError(error: unknown) {
  console.error('Docs operation failed', error instanceof Error ? error.name : 'UnknownError');
}
