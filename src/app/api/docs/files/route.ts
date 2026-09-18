import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireActionMember } from '@/lib/docs/auth';
import { uploadFile } from '@/lib/docs/files';
import { DomainError } from '@/lib/docs/domain';
import { reportError } from '@/lib/docs/monitoring';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    await assertSameOrigin();
    const m = await requireActionMember();
    if (Number(request.headers.get('content-length')) > 4.25 * 1024 * 1024)
      throw new DomainError('File is too large.', 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new DomainError('Choose a file.');
    const data = await uploadFile(
      m.id,
      String(form.get('documentId') || ''),
      String(form.get('session') || ''),
      file,
    );
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (!(e instanceof DomainError)) await reportError(e);
    return NextResponse.json(
      { error: e instanceof DomainError ? e.message : 'Upload failed.' },
      { status: e instanceof DomainError ? e.code : 500 },
    );
  }
}
