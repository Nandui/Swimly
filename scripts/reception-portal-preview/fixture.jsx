import React, { createContext, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Image from 'next/image';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, ClipboardList, Files, HelpCircle, LogOut, MapPin, Search, UserPlus, Users, WavesLadder } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Card } from '@/components/shadcn/card';
import { Label } from '@/components/shadcn/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeFlip } from '@/components/theme-toggle';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { Tag } from '@/components/ui-kit/tag';
import { cn } from '@/lib/utils';
import { moduleStatusMeta } from '@/lib/modules';

/* Design study, not an authenticated application. All destinations are local
 * explanations and every count is synthetic. No production data or actions.
 * Three structures inside Turnfin's established Neutral / Figtree identity:
 * directory (candidate 7), follow-up queue (4), reception desk (2).
 * Surface concept seed 7417f6fb. Final layout remains the owner's choice. */
const designs = [
  { id: 'directory', name: 'Module directory', description: 'A clear home for every reception module, with shortcuts beside each one.' },
  { id: 'follow-up', name: 'Follow-up queue', description: 'Outstanding work comes first. Modules sit alongside it.' },
  { id: 'desk', name: 'Reception desk', description: 'Everyday Aquatics tasks take the lead, with other modules close by.' },
];
const actions = [
  { id: 'swimmers', title: 'Find a swimmer', detail: 'Details, progress and enrolment', icon: Search, path: '/students' },
  { id: 'classes', title: 'Find a class', detail: 'Times, instructors and spaces', icon: CalendarDays, path: '/courses' },
  { id: 'add', title: 'Add a swimmer', detail: 'Create a new swimmer record', icon: UserPlus, path: '/students' },
  { id: 'assessments', title: 'Book an assessment', detail: 'Find a session and book a place', icon: ClipboardList, path: '/assessments' },
  { id: 'siblings', title: 'Find sibling times', detail: 'Lessons that work for the family', icon: Users, path: '/together' },
];
const queues = [
  { id: 'enrolment', title: 'Awaiting enrolment', detail: 'Find a class place for an assessed or waitlisted swimmer.', path: '/awaiting-enrolment', counts: [8, 5] },
  { id: 'moves', title: 'Ready to move', detail: 'Swimmers marked ready by their instructor.', path: '/awaiting-enrolment', counts: [4, 2] },
  { id: 'agreements', title: 'Legend agreements', detail: 'Enrolments with a billing agreement still to confirm.', path: '/legend-agreements', counts: [3, 1] },
  { id: 'parents', title: 'Parent access requests', detail: 'Across both sites. Check requests to link a parent to their child.', path: '/parent-access', counts: [5, 5] },
];
const destinations = {
  ...Object.fromEntries(actions.map(item => [item.id, { ...item, explanation: 'This shortcut opens the existing Aquatics workflow. The working site carries through; swimmer records remain shared across both sites.' }])),
  ...Object.fromEntries(queues.map(item => [item.id, { ...item, explanation: 'This opens the relevant Aquatics follow-up list. Staff only see links and counts for screens they are permitted to use.' }])),
  aquatics: { title: 'Aquatics', path: '/start', explanation: 'Opens the existing swim-school workspace with the screens and actions this staff member is permitted to use.' },
  docs: { title: 'Docs', path: '/docs', explanation: 'Opens Turnfin Docs with the same staff login. Docs retains its own design and document permissions.' },
  reading: { title: 'My reading', path: '/docs/my-work', explanation: 'Opens assigned reading in Docs. Reading counts would come from the signed-in staff member’s document assignments.' },
  help: { title: 'Help centre', path: '/help', explanation: 'Opens the staff guides and screenshots for using Aquatics.' },
  modules: { title: 'All Turnfin modules', path: '/modules', explanation: 'Other staff keep their current module portal. Receptionists land on the Reception Portal after signing in.' },
  account: { title: 'Your account', path: '/account', explanation: 'Opens account settings for the signed-in staff member.' },
  signout: { title: 'Signed out of the design preview', explanation: 'In the app this signs the staff member out and returns to sign-in. This preview has no authenticated session.' },
};
const params = new URLSearchParams(location.search);
const initialTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = initialTheme;

const PreviewContext = createContext(null);

  function LinkAction({ id, children, primary = false, className }) {
    const { open } = useContext(PreviewContext);
    return <Button variant={primary ? 'default' : 'ghost'} onClick={() => open(id)} className={cn('min-h-11', className)}>{children}</Button>;
  }

  function TaskLinks({ compact = false }) {
    const { open } = useContext(PreviewContext);
    return <div className={cn('grid gap-2', !compact && 'sm:grid-cols-2')}>
      {actions.map(({ id, title, detail, icon: Icon }) => <Button key={id} variant="ghost" onClick={() => open(id)} className="h-auto min-h-16 justify-start gap-3 whitespace-normal px-3 py-3 text-left">
        <Icon className="size-5 text-ui-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="mt-1 block text-xs font-normal leading-relaxed text-ui-muted-foreground">{detail}</span></span>
        <ChevronRight className="text-ui-muted-foreground" aria-hidden="true" />
      </Button>)}
    </div>;
  }

  function Queue({ counts = false }) {
    const { open, siteIndex } = useContext(PreviewContext);
    return <div className="divide-y divide-ui-border">
      {queues.map(({ id, title, detail, counts: values }) => <Button key={id} onClick={() => open(id)} variant="ghost" className="h-auto min-h-20 w-full justify-start gap-4 rounded-none whitespace-normal px-4 py-4 text-left sm:px-6">
        {counts && <span className="w-7 shrink-0 text-xl font-semibold tabular-nums text-ui-primary">{values[siteIndex]}</span>}
        <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="mt-1 block text-xs font-normal leading-relaxed text-ui-muted-foreground">{detail}</span></span>
        <ChevronRight aria-hidden="true" className="text-ui-muted-foreground" />
      </Button>)}
    </div>;
  }

  function ModuleHeading({ id, compact = false }) {
    const docs = id === 'docs';
    const title = docs ? 'Docs' : 'Bookings';
    const Icon = docs ? Files : CalendarDays;
    const status = moduleStatusMeta[docs ? 'available' : 'planned'];
    return <div className="flex items-start gap-4">
      <Icon className="mt-1 size-6 shrink-0 text-ui-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-3"><h2 className={compact ? 'text-lg font-semibold' : 'text-xl font-semibold'}>{title}</h2><Tag color={status.color}>{status.label}</Tag></div>
        <p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">{docs ? 'Procedures, policies and the documents you need at the desk.' : 'A home for reception booking tools as we develop them.'}</p>
      </div>
    </div>;
  }

  function OtherModules({ rows = false, horizontal = false }) {
    return <div className={horizontal ? 'grid gap-4 md:grid-cols-2' : rows ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-1'}>
      <Card className="gap-5 p-5 shadow-none sm:p-6">
        <ModuleHeading id="docs" />
        <div className="flex flex-wrap items-center gap-2"><LinkAction id="docs" className="border border-ui-border bg-ui-background">Open Docs <ArrowUpRight aria-hidden="true" /></LinkAction><LinkAction id="reading">My reading</LinkAction></div>
      </Card>
      <Card className="gap-4 p-5 shadow-none sm:p-6"><ModuleHeading id="bookings" /><p className="text-xs leading-relaxed text-ui-muted-foreground">This module will appear here when it is ready.</p></Card>
    </div>;
  }

function Preview() {
  const [design, setDesign] = useState(designs.some(item => item.id === params.get('layout')) ? params.get('layout') : 'directory');
  const [site, setSite] = useState('Bishopstown');
  const [destination, setDestination] = useState(null);
  const [chosen, setChosen] = useState(null);
  const siteIndex = site === 'Bishopstown' ? 0 : 1;
  const current = designs.find(item => item.id === design);
  const open = (id) => { setDestination(id); window.scrollTo({ top: 0, behavior: 'instant' }); };

  function chooseDesign(id) {
    setDesign(id);
    setDestination(null);
    const url = new URL(location.href);
    url.searchParams.set('layout', id);
    history.replaceState(null, '', url);
  }

  return <PreviewContext.Provider value={{ open, siteIndex }}><div className="min-h-svh bg-ui-workspace text-ui-foreground">
    <a href="#reception-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to content</a>
    <div className="border-b border-ui-border bg-ui-background px-4 py-3 lg:px-6" aria-label="Design preview controls">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ui-muted-foreground">Design preview · example data · no live changes</p>
        <div className="flex w-full flex-wrap gap-1 sm:w-auto" aria-label="Compare layouts">
          {designs.map((item, index) => <Button key={item.id} variant={design === item.id ? 'secondary' : 'ghost'} aria-pressed={design === item.id} onClick={() => chooseDesign(item.id)} className="min-h-11 px-3 text-xs">{index + 1}. {item.name}</Button>)}
        </div>
      </div>
    </div>
    <header className="border-b border-ui-border bg-ui-background px-4 lg:px-6">
      <div className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2"><span className="relative size-12 shrink-0 overflow-hidden" aria-hidden="true"><Image src="/brand/turnfin.png" width={1254} height={1254} alt="" className="absolute -left-5 -top-5 size-22 max-w-none" /></span><p className="text-xl font-semibold">Turnfin<span className="mt-0.5 block text-xs font-normal text-ui-muted-foreground">Reception Portal</span></p></div>
        <div className="flex items-center gap-1"><LinkAction id="account" className="hidden sm:inline-flex">Alex Example</LinkAction><div className="[&_button]:size-11"><ThemeFlip /></div><LinkAction id="signout"><LogOut aria-hidden="true" /><span className="sr-only sm:not-sr-only">Sign out</span></LinkAction></div>
      </div>
    </header>
    <main id="reception-main" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-6 lg:py-8">
      {destination ? <section className="space-y-6">
        <Button variant="ghost" onClick={() => setDestination(null)} className="min-h-11"><ArrowLeft aria-hidden="true" />Back to Reception Portal</Button>
        <Card className="gap-4 p-6 shadow-none"><h1 className="text-2xl font-semibold">{destinations[destination].title}</h1><p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">{destinations[destination].explanation}</p><p className="text-sm">Working site: <strong className="font-medium">{site}</strong></p><p className="text-xs text-ui-muted-foreground">Preview destination only. Nothing has been opened or changed in the live app.</p></Card>
      </section> : <>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Reception Portal</h1><p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">Your tools for helping customers and keeping the desk running.</p></div>
          <div className="w-full space-y-2 sm:w-56 sm:shrink-0"><Label htmlFor="working-site" className="block text-xs font-medium">Working site</Label><Select value={site} onValueChange={setSite}><SelectTrigger id="working-site" className="min-h-11 w-full bg-ui-background"><MapPin aria-hidden="true" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bishopstown" className="min-h-11">Bishopstown</SelectItem><SelectItem value="Churchfield" className="min-h-11">Churchfield</SelectItem></SelectContent></Select></div>
        </div>
        {design === 'directory' && <section className="space-y-4" aria-label="Reception modules">
          <Card className="gap-0 overflow-hidden p-0 shadow-none"><div className="grid lg:grid-cols-3"><div className="space-y-4 border-b border-ui-border p-5 sm:p-6 lg:border-r lg:border-b-0"><WavesLadder className="size-7 text-ui-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">Aquatics</h2><p className="text-sm leading-relaxed text-ui-muted-foreground">Swimmers, lessons and everything the swim-school desk needs.</p><LinkAction id="aquatics" primary className="w-full justify-between">Open Aquatics<ArrowRight aria-hidden="true" /></LinkAction></div><div className="p-3 sm:p-4 lg:col-span-2"><TaskLinks /></div></div><div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-ui-border px-3 py-3 sm:px-5">{queues.map(item => <LinkAction key={item.id} id={item.id} className="text-xs">{item.title}<ArrowUpRight aria-hidden="true" /></LinkAction>)}</div></Card>
          <OtherModules horizontal />
        </section>}
        {design === 'follow-up' && <div className="grid items-start gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><section><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Follow up at {site}</h2><p className="text-xs text-ui-muted-foreground">Example counts</p></div><Card className="gap-0 overflow-hidden p-0 shadow-none"><Queue counts /></Card></section><section><h2 className="mb-4 text-xl font-semibold">Help a customer</h2><Card className="p-3 shadow-none"><TaskLinks /></Card></section></div><aside className="space-y-4" aria-label="Reception modules"><h2 className="text-xl font-semibold">Your modules</h2><Card className="gap-4 p-5 shadow-none sm:p-6"><div className="flex items-center gap-3"><WavesLadder className="size-6 text-ui-primary" aria-hidden="true" /><h3 className="text-lg font-semibold">Aquatics</h3></div><p className="text-sm leading-relaxed text-ui-muted-foreground">Manage swimmers, classes and enrolment.</p><LinkAction id="aquatics" primary className="w-full justify-between">Open Aquatics<ArrowRight aria-hidden="true" /></LinkAction></Card><OtherModules rows /></aside></div>}
        {design === 'desk' && <><div className="grid items-start gap-4 lg:grid-cols-3"><Card className="gap-0 overflow-hidden p-0 shadow-none lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-ui-border p-5 sm:p-6"><div className="flex items-center gap-3"><WavesLadder className="size-7 text-ui-primary" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Aquatics</h2><p className="mt-1 text-xs text-ui-muted-foreground">Swimmers and swim-school lessons</p></div></div><LinkAction id="aquatics" primary>Open Aquatics<ArrowUpRight aria-hidden="true" /></LinkAction></div><div className="p-3 sm:p-4"><TaskLinks /></div><p className="border-t border-ui-border px-5 py-4 text-xs leading-relaxed text-ui-muted-foreground sm:px-6">Working at {site}. You can find and enrol swimmers from either site.</p></Card><OtherModules /></div><section><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Follow up</h2><p className="text-xs text-ui-muted-foreground">Aquatics · {site}</p></div><Card className="gap-0 overflow-hidden p-0 shadow-none"><div className="grid divide-y divide-ui-border sm:grid-cols-2 sm:divide-y-0">{queues.map(({ id, title, detail }) => <Button key={id} onClick={() => open(id)} variant="ghost" className="h-auto min-h-24 justify-start gap-3 rounded-none whitespace-normal p-5 text-left sm:p-6"><span className="flex-1"><span className="block font-medium">{title}</span><span className="mt-1 block text-xs font-normal leading-relaxed text-ui-muted-foreground">{detail}</span></span><ChevronRight aria-hidden="true" /></Button>)}</div></Card></section></>}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-4"><p className="text-xs text-ui-muted-foreground">Signed in as <span className="font-medium text-ui-foreground">Alex Example</span></p><div className="flex flex-wrap gap-1"><LinkAction id="help"><HelpCircle aria-hidden="true" />Help centre</LinkAction><LinkAction id="modules">All modules<ArrowUpRight aria-hidden="true" /></LinkAction></div></footer>
        <section aria-label="Design notes" className="space-y-3 rounded-ui-lg border border-dashed border-ui-border p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">{current.name}</p><p className="mt-1 text-xs leading-relaxed text-ui-muted-foreground">{current.description}</p></div><Button onClick={() => setChosen(design)} variant={chosen === design ? 'secondary' : 'outline'} className="min-h-11">{chosen === design && <Check aria-hidden="true" />}{chosen === design ? 'Preferred layout' : 'Choose this layout'}</Button></div><p className="text-xs leading-relaxed text-ui-muted-foreground">Default after receptionists sign in. Other staff keep the existing portal. Modules, shortcuts and queues only appear with the relevant access; this example shows the full set.</p>{chosen && <p role="status" className="text-sm">Selected: {designs.find(item => item.id === chosen).name}. Tell Codex your choice to continue with this design.</p>}</section>
      </>}
    </main>
  </div></PreviewContext.Provider>;
}

createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={initialTheme}><TooltipProvider><Preview /></TooltipProvider></ThemeProvider>);
