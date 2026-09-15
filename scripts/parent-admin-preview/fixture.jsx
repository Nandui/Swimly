// Actual staff components; all names and API records are synthetic.
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import { createRoot } from 'react-dom/client';
import Link from 'next/link';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { ToastBridge } from '@/lib/toast';
import { Button } from '@/components/shadcn/button';
import { ParentAccounts } from '@/components/parents/parent-accounts';
import { ParentAccessRequests } from '@/components/parents/access-requests';
import { AssessmentPublicationPanel } from '@/components/parents/assessment-publication';
import { SwimmerProfile } from '@/components/students/swimmer-profile';
import { SwimmerBrowser } from '@/components/students/swimmer-browser';
import { PageHeader } from '@/components/ui-kit/page-header';
import { BackLink } from '@/components/ui-kit/back-link';
import { swimmers, enrolments, progress, history, courses } from '../help-screenshots/data.mjs';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const screen = params.get('screen') || (location.pathname === '/students/parents' ? 'accounts' : 'profile');
const demo = window.parentAdminDemo;
window.helpDemo = { history, swimmers };
function Screen() {
  if (screen === 'accounts') return <div className="space-y-6"><BackLink href="/?screen=directory" current="Parent accounts">Swimmers</BackLink><PageHeader title="Parent accounts" description="Review family requests and manage access to LeisureWorld Aquatics."/><ParentAccessRequests/><section className="space-y-4 border-t border-ui-border pt-6"><h2 className="text-xl font-semibold">Find a parent account</h2><ParentAccounts/></section></div>;
  if (screen === 'publication') return <div className="space-y-6"><BackLink href="/?screen=directory" current="Assessment">Assessments</BackLink><PageHeader title="Swim school assessment" description={`${demo.date} · 16:00–16:30 · LeisureWorld Bishopstown · Water Safety & Fun`}/><AssessmentPublicationPanel sessionId="demo-assessment" startsAt={demo.startsAt} sessionLabel={`${demo.date} · 16:00–16:30 · LeisureWorld Bishopstown · Water Safety & Fun`}/></div>;
  if (screen === 'directory') return <SwimmerBrowser students={swimmers} total={4} page={1} pageSize={25} counts={{all:4,active:4,inactive:0}} q="" status="ALL" parentAction={<Button asChild variant="outline" className="min-h-11"><Link href="/?screen=accounts">Parent accounts</Link></Button>} addAction={<Button className="min-h-11">Add swimmer</Button>}/>;
  return <SwimmerProfile student={swimmers[0]} enrolments={enrolments} programmes={progress} assessments={[]} targets={courses} history={history} returnTo="/?screen=directory" instant={demo.instant} initialTab="parents" access={{edit:false,enrol:false,assess:false,complete:false,override:false,courses:true,assessments:true,audit:false,parents:screen!=='restricted'}}/>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider><ToastBridge/>
  <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
  <div className="border-b border-ui-border px-4 py-2 text-xs text-ui-muted-foreground">Isolated staff preview · synthetic examples · no emails sent</div>
  <main id="main-content" className="p-4 text-sm lg:p-6" data-capture><Screen/></main>
</TooltipProvider></ThemeProvider>);
