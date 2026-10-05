import { requireMember } from '@/lib/docs/auth';
import { workspace } from '@/lib/docs/queries';
import { HomeView } from '@/components/docs/home';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Docs' };
export default async function HomePage() {
  // The overview's one line: what Docs is for. Required reading itself is in Turnfin Me.
  return <HomeView workspace={await workspace((await requireMember()).id)} description="Read, write and approve staff documents" />;
}
