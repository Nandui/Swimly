import { fileResponse, readEvidence } from "@/modules/training/features/sign-off";

/** A photo taken as evidence at a practical sign-off, for people whose Training records reach that person. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const file = await readEvidence((await params).id);
    if (file) return fileResponse(file);
  } catch {
    // Not signed in, or the person is out of reach: the same answer as a missing file.
  }
  return new Response("Photo not available.", { status: 404, headers: { "Cache-Control": "no-store" } });
}
