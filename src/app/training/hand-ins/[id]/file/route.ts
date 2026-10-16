import { AuthorizationError } from "@/lib/authz";
import { fileResponse, handInFile } from "@/modules/training/features/hand-ins";

/** A photo or PDF handed in on a Hand in work lesson, for someone who may sign
 *  off the person's training. Served inline, never cached, nothing in it runs. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const file = await handInFile(id);
    return file ? fileResponse(file) : new Response("Not found", { status: 404 });
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
}
