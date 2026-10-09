// Real Docs components; fictional staff and documents in a separate in-memory DB.
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@/app/theme/docs-shell.css';
import '@/app/theme/docs-integration.css';
import '@/app/docs/brand.css';
import '@/app/docs/editor.css';
import '@/app/theme/poolside.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { Shell } from '@/modules/docs/components/shell';
import { HomeView } from '@/modules/docs/components/home';
import { LibraryView } from '@/modules/docs/components/library';
import { WorkView } from '@/modules/docs/components/work';
import { ReportsView } from '@/modules/docs/components/reports';
import { AdminView } from '@/modules/docs/components/admin';
import { NewDocument } from '@/modules/docs/components/new-document';
import { DocumentEditor } from '@/modules/docs/components/document-editor';
import { Reader } from '@/modules/docs/components/reader';
import { HistoryView } from '@/modules/docs/components/history';
import { DocumentBody, RiskAssessmentView, tableOfContents } from '@/modules/docs/components/document-body';

async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.has('as')) sessionStorage.setItem('docs-example-actor', params.get('as'));
  const who = sessionStorage.getItem('docs-example-actor') || 'alex';
  window.docsAction = async (name, ...args) => (await fetch('/__docs-action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ who, name, args }),
  })).json();
  const data = await (await fetch('/__docs-data?'+new URLSearchParams({ who, path: location.pathname, query: location.search }))).json();
  const w = data.workspace, p = location.pathname;
  let screen;
  if (p === '/docs/library') screen = <LibraryView workspace={w} archived={false} documents={w.documents}/>;
  else if (p === '/docs/work') screen = <WorkView workspace={w} drafts={data.drafts}/>;
  else if (p === '/docs/reports') screen = <ReportsView workspace={w} items={data.items} documents={w.documents}/>;
  else if (p === '/docs/admin') screen = <AdminView workspace={w} events={data.events} mail={[]}/>;
  else if (p === '/docs/documents/new') screen = <NewDocument workspace={w}/>;
  else if (p.endsWith('/edit')) screen = <DocumentEditor workspace={w} initial={data.view.draft}/>;
  else if (p.endsWith('/history')) screen = <HistoryView workspace={w} id={data.view.document.id} snapshots={data.view.snapshots} events={data.events} archived={false}/>;
  else if (p.startsWith('/docs/documents/')) {
    const content = data.view.selected?.content || data.view.draft.content;
    screen = <Reader workspace={w} {...data.view} content={content} toc={tableOfContents(content.body)}><DocumentBody body={content.body}/><RiskAssessmentView content={content} members={w.members}/></Reader>;
  } else screen = <HomeView workspace={w}/>;
  createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={params.get('theme') || 'light'}><TooltipProvider>
    {p === '/modules' ? screen : <div className="turnfin-docs"><Shell workspace={{...w,outstandingReading:w.requirements.filter(r=>r.status==='outstanding').length}}>{screen}</Shell></div>}
  </TooltipProvider></ThemeProvider>);
}
void boot();
