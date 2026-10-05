import { requireMember } from '@/lib/docs/auth';
import { readingReportScope } from '@/lib/docs/report-scope';
import { Shell } from '@/components/docs/shell';
import './docs.css';
import './integration.css';
import './editor.css';
export const metadata = { title: { absolute: 'Turnfin Docs' } };
export const dynamic = 'force-dynamic';
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const m = await requireMember();
  const data = {
    member: m,
    localMode: false,
    canReport: (await readingReportScope(m)) !== null,
    // Required reading is read and acknowledged in Turnfin Me, not on Work.
    outstandingReading: 0,
  };
  return (
    <div className="turnfin-docs"><Shell workspace={data}>
      {children}
    </Shell></div>
  );
}
