import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@/app/docs/brand.css';
import '@/app/reception-portal/reception.css';
import { ReceptionPortal } from '@/components/portal/reception-portal';
import { StaffPortal } from '@/components/portal/staff-portal';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { Button } from '@/components/shadcn/button';
import { ToastBridge } from '@/lib/toast';
import { receptionPortalAccess } from '@/lib/reception-portal';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;
const clubs = [{id:'example-bishopstown',name:'LeisureWorld Bishopstown'},{id:'example-churchfield',name:'LeisureWorld Churchfield'}];
const grants = {
  reception: { permissions:['students.manage','enrolment.manage','refunds.request'], screens:['students','courses','assessments','together','awaiting-enrolment','refunds'] },
  admin: { permissions:['staff.manage','roles.manage'], screens:[] },
  read: { permissions:[], screens:['students','courses'] },
  docs: { permissions:['docs.read'], screens:['docs'] },
};
const profile = Object.hasOwn(grants, params.get('access')) ? params.get('access') : 'reception';
const access = receptionPortalAccess(grants[profile].permissions, grants[profile].screens);
window.receptionFixture = {
  calls: [],
  async action(name, ...args) {
    this.calls.push({name, args});
    if(name === 'switchClub') {
      if(params.has('site-error')) return {ok:false,error:'Synthetic connection failure. Please try again.'};
      window.dispatchEvent(new CustomEvent('preview-site',{detail:args[0]}));
      return {ok:true};
    }
    return {ok:false,error:'Preview only. No swimmer has been added; your entries are still here.'};
  },
};

function Preview() {
  const [club, setClub] = useState(clubs[0]);
  useEffect(() => {
    const update = event => setClub(clubs.find(item => item.id === event.detail) ?? clubs[0]);
    window.addEventListener('preview-site', update);
    return () => window.removeEventListener('preview-site', update);
  }, []);
  useEffect(() => {
    const openRefunds = event => {
      const link = event.target instanceof Element && event.target.closest('a[href="/refunds"]');
      if (!link) return;
      event.preventDefault();
      location.assign('http://127.0.0.1:4201/refunds');
    };
    document.addEventListener('click', openRefunds);
    return () => document.removeEventListener('click', openRefunds);
  }, []);
  const name = params.has('long-name') ? 'Alexandra Example-Longsurname Example-Longsurname' : 'Alex Example';
  if(location.pathname === '/modules') return <StaffPortal userName={name} refundsAllowed={access.refunds} docsAllowed={access.docs} aquaticsAllowed={access.aquatics} receptionAllowed={access.available} />;
  if(!['/','/reception-portal'].includes(location.pathname)) return <main className="space-y-4 p-6"><h1 className="text-2xl font-semibold">Preview destination</h1><p className="text-sm">{location.pathname}{location.search}</p><p className="text-sm text-ui-muted-foreground">The real app opens this existing workflow. This preview is isolated from customer data.</p><Button asChild className="min-h-11"><a href="/reception-portal">Back to Reception Portal</a></Button></main>;
  return <><p className="border-b border-ui-border bg-ui-background px-4 py-2 text-center text-xs text-ui-muted-foreground">Implementation preview · fictional staff · no live writes</p><ReceptionPortal userName={name} access={access} club={club} clubs={clubs} /></>;
}

createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider><ToastBridge /><Preview /></TooltipProvider></ThemeProvider>);
