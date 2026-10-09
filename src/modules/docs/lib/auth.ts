import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { database } from './database';
import { actor, DomainError } from './domain';

export async function requireMember() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in');
  try { return await actor(await database(), session.user.id); }
  catch (error) {
    if (error instanceof DomainError && [401, 403].includes(error.code)) notFound();
    throw error;
  }
}
export async function requireActionMember() {
  const session = await auth();
  if (!session?.user?.id) throw new DomainError('Please sign in again.', 401);
  return actor(await database(), session.user.id);
}
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') || h.get('host');
  let allowed = false;
  try { allowed = !!origin && new URL(origin).host === host; } catch { /* Invalid origin. */ }
  if (!allowed) throw new DomainError('Request origin is not allowed.', 403);
}
