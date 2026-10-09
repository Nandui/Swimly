import type { Metadata } from 'next';
import { TITLE_TEMPLATE } from '@/lib/app';
import { requireMember } from '@/modules/docs/lib/auth';
import { readingReportScope } from '@/modules/docs/lib/report-scope';
import { Shell } from '@/modules/docs/components/shell';
import '../theme/docs-shell.css';
import '../theme/docs-integration.css';
import './editor.css';
export const metadata: Metadata = { title: { default: 'Docs', template: TITLE_TEMPLATE } };
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
