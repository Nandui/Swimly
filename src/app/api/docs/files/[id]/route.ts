import { DomainError, readAttachment, requireActionMember } from "@/modules/docs/features/files";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const m = await requireActionMember();
    const { file, bytes } = await readAttachment(m.id, (await params).id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': file.mime,
        'Content-Disposition': `${file.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return new Response(e instanceof DomainError ? e.message : 'Could not load the file. Try again.', {
      status: e instanceof DomainError ? e.code : 500,
    });
  }
}
