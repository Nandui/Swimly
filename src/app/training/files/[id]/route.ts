import { fileResponse, readCourseFile } from "@/modules/training/features/builder";

/** A lesson's image or PDF, for the builder and its preview. Learners get theirs
 *  through Turnfin Me's staff API. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const file = await readCourseFile((await params).id);
    if (file) return fileResponse(file);
  } catch {
    // Not signed in, or no Training access: the same answer as a missing file.
  }
  return new Response("File not available.", { status: 404, headers: { "Cache-Control": "no-store" } });
}
