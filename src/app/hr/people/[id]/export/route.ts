import { AuthorizationError } from "@/lib/authz";
import { ExportRefused, subjectExport } from "@/modules/hr/features/export";

/** Superadmin subject export: one JSON file of everything held about a person's
 *  employment. Never cached; refused without a recent password. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await subjectExport(id);
    if (!data) return new Response("Not found", { status: 404 });
    const name = data.person.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "person";
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="turnfin-record-${name}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ExportRefused || error instanceof AuthorizationError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
