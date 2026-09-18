// Actual staff components, synthetic records and in-memory actions only.
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { Button } from '@/components/shadcn/button';
import { HelpBrowser } from '@/components/help/help-browser';
import { SwimmerProfile } from '@/components/students/swimmer-profile';
import { ClassEnrolmentDialog } from '@/components/students/class-enrolment-dialog';
import { DutyView } from '@/components/duty/duty-view';
import { BillingList } from '@/components/duty/billing-list';
import InstructorError from '@/app/(instructor)/instructor/error';
import { articlesForScope, summarizeArticle } from '@/lib/help/catalogue';
import { courses, enrolments, progress, history, swimmers, date, levels } from '../help-screenshots/data.mjs';

const initial = new URLSearchParams(location.search);
const screen = initial.get('screen') ?? 'help';
const theme = initial.get('theme') ?? 'light';
const targets = [courses[1], {...courses[2],levelId:levels[1].id,level:levels[1]}];
const access = {edit:false,enrol:false,assess:false,complete:false,override:false,courses:true,assessments:true,audit:true};
window.shadcnPreview = { submitted:null, resets:0, history:async()=>history };
// Next patches the History API to refresh useSearchParams. Mirror that boundary
// here without importing Next's server runtime or any database module.
for (const method of ['pushState','replaceState']) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args) => { original(...args); window.dispatchEvent(new Event('fixture-navigation')); };
}
function subscribe(listener) {
  window.addEventListener('fixture-navigation',listener);
  return () => window.removeEventListener('fixture-navigation',listener);
}
function Screen() {
  useSyncExternalStore(subscribe,()=>location.href);
  if (screen === 'help') return <HelpBrowser articles={articlesForScope('desk').map(summarizeArticle)} scope="desk"/>;
  if (screen === 'profile') return <SwimmerProfile student={swimmers[0]} enrolments={enrolments} programmes={progress} assessments={[]} targets={courses} history={history} access={access} returnTo="/students" instant={date+'T12:00:00Z'}/>;
  if (screen === 'duty') return <DutyView courses={[]} iso={date} clubName="Example site" initialNow={900} canCancel={false} canBilling={false} pendingBilling={0}/>;
  if (screen === 'billing') return <><h1 className="text-2xl font-semibold">Billing follow-up</h1><BillingList rows={[]} notified={false} canNotify={false}/></>;
  if (screen === 'error') return <InstructorError reset={()=>{window.shadcnPreview.resets++;}}/>;
  return <><h1 className="mb-6 text-2xl font-semibold">Class placement</h1><ClassEnrolmentDialog
    trigger={<Button>Choose class</Button>} courses={targets} currentEnrolment={screen==='move'?enrolments[0]:undefined}
    submit={async data=>{window.shadcnPreview.submitted=Object.fromEntries(data);return {ok:false,error:'Example save failed. Your choices are still here.'};}}/></>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider>
  <div className="border-b border-ui-border p-3 text-xs text-ui-muted-foreground">Staff UI preview · fictional records · no live changes</div>
  <main className="min-w-0 p-4 text-sm lg:p-6"><Screen/></main>
</TooltipProvider></ThemeProvider>);
