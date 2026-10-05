import { requireMember } from '@/lib/docs/auth';
import { workspace } from '@/lib/docs/queries';
import { HomeView } from '@/components/docs/home';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Docs' };
export default async function HomePage() {
  return <HomeView workspace={await workspace((await requireMember()).id)} />;
}
