import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import {StaffPortal} from '@/components/portal/staff-portal';
import {ThemeProvider} from '@/components/theme-provider';
import {TooltipProvider} from '@/components/shadcn/tooltip';
import {AppShell} from '@/components/ui-kit/app-shell';

const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;
window.portalPreview = {fail: false, calls: []};

// Fictional staff only. Authentication and the workspace are explicit preview boundaries.
function Preview() {
  if (location.pathname === '/sign-in') return <main className="p-6"><h1 className="text-2xl font-semibold">Signed out of preview</h1></main>;
  if (location.pathname === '/start') return <AppShell wordmark="Swimly" homeHref="/start" portalHref="/modules" groups={[]} userName="Alex Example"><h1 className="text-2xl font-semibold">Swimly workspace preview</h1><p className="mt-4 text-sm">In the app, your role determines which workspace opens.</p></AppShell>;
  return <StaffPortal userName={new URLSearchParams(location.search).has('long-name') ? 'Alexandra Example-Longsurname Example-Longsurname' : 'Alex Example'} />;
}

createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider><Preview /></TooltipProvider></ThemeProvider>);
