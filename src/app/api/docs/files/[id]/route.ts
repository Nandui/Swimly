import { requireActionMember } from '@/lib/docs/auth';
import { readAttachment } from '@/lib/docs/files';
import { DomainError } from '@/lib/docs/domain';
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
    return new Response(e instanceof DomainError ? e.message : 'Unable to load file.', {
      status: e instanceof DomainError ? e.code : 500,
    });
  }
}
