import { requireMember } from '@/lib/docs/auth';
import { workspace } from '@/lib/docs/queries';
import { HomeView } from '@/components/docs/home';
export default async function HomePage() {
  return <HomeView workspace={await workspace((await requireMember()).id)} />;
}
